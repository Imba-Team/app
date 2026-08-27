import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../users/user.service';
import { MailQueueService } from 'src/common/mail/mail-queue.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

export const MagicLinkPurpose = {
  EMAIL_VERIFICATION: 'email-verification',
  FORGOT_PASSWORD: 'forgot-password',
} as const;

export type MagicLinkPurposeValue =
  (typeof MagicLinkPurpose)[keyof typeof MagicLinkPurpose];

interface PurposeConfig {
  /** Frontend path the email link should point at (token appended as `?token=...`). */
  frontendPath: string;
  /** TTL in milliseconds. */
  ttlMs: number;
  /** Subject line and body templating. */
  subject: (appName: string) => string;
  body: (link: string, ttlMs: number) => string;
}

const FALLBACK_FRONTEND_URL = 'http://localhost:5173';
const APP_NAME = 'Mimir';

const PURPOSE_CONFIG: Record<MagicLinkPurposeValue, PurposeConfig> = {
  [MagicLinkPurpose.EMAIL_VERIFICATION]: {
    frontendPath: '/auth/verify-email',
    ttlMs: 24 * 60 * 60 * 1000,
    subject: (app) => `Verify your ${app} email`,
    body: (link, ttlMs) => `
      <h1>Welcome to ${APP_NAME}</h1>
      <p>Please confirm your email address by clicking the link below:</p>
      <p><a href="${link}" target="_blank" rel="noopener">${link}</a></p>
      <p>This link expires in ${Math.round(ttlMs / (60 * 60 * 1000))} hours.</p>
      <p>If you didn't create a ${APP_NAME} account, you can safely ignore this email.</p>
    `,
  },
  [MagicLinkPurpose.FORGOT_PASSWORD]: {
    frontendPath: '/auth/reset-password',
    ttlMs: 15 * 60 * 1000,
    subject: (app) => `Reset your ${app} password`,
    body: (link, ttlMs) => `
      <h1>Reset your password</h1>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <p><a href="${link}" target="_blank" rel="noopener">${link}</a></p>
      <p>This link expires in ${Math.round(ttlMs / (60 * 1000))} minutes.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
    `,
  },
};

interface SendVerificationParams {
  to: string;
  userId: string;
  purpose: MagicLinkPurposeValue;
}

@Injectable()
export class MagicLinkService {
  private readonly context = 'MagicLinkService';

  constructor(
    private readonly userService: UsersService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MailQueueService))
    private readonly mailQueue: MailQueueService,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext(this.context);
  }

  private generateVerificationToken(purpose: string): string {
    return `${purpose}-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`;
  }

  private buildLink(purpose: MagicLinkPurposeValue, token: string): string {
    const configured =
      this.config.get<string>('FRONTEND_BASE_URL') ??
      this.config.get<string>('BASE_URL');
    if (!configured && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FRONTEND_BASE_URL is not configured. Refusing to send emails ' +
          'with localhost links in production.',
      );
    }
    const base = configured ?? FALLBACK_FRONTEND_URL;
    const trimmed = base.replace(/\/$/, '');
    const path = PURPOSE_CONFIG[purpose].frontendPath;
    return `${trimmed}${path}?token=${encodeURIComponent(token)}`;
  }

  async sendVerificationLink({ to, userId, purpose }: SendVerificationParams) {
    const config = PURPOSE_CONFIG[purpose];
    const token = this.generateVerificationToken(purpose);

    await this.prisma.magicLink.deleteMany({
      where: { userId, purpose },
    });

    const magicLink = await this.prisma.magicLink.create({
      data: {
        key: token,
        userId,
        purpose,
        expiresAt: new Date(Date.now() + config.ttlMs),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const link = this.buildLink(purpose, token);

    await this.mailQueue.enqueue({
      to,
      subject: config.subject(APP_NAME),
      html: config.body(link, config.ttlMs),
      context: `magic-link.${purpose}`,
    });

    return {
      ok: true,
      message: 'Verification link queued',
      data: {
        expiresAt: magicLink.expiresAt,
      },
    };
  }

  async verifyToken(token: string, purpose: MagicLinkPurposeValue) {
    this.logger.debug(`Verifying token for purpose=${purpose}`);

    const verificationToken = await this.prisma.magicLink.findFirst({
      where: {
        key: token,
        purpose,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      this.logger.warn(`Token not found or expired (purpose=${purpose})`);
      throw new HttpException(
        {
          ok: false,
          message: 'Invalid or expired verification link',
          code: 'INVALID_TOKEN',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.magicLink.deleteMany({ where: { key: token } });

    return {
      ok: true,
      data: verificationToken,
    };
  }

  async getToken(token: string, purpose?: MagicLinkPurposeValue) {
    const verificationToken = await this.prisma.magicLink.findUnique({
      where: { key: token },
    });

    if (!verificationToken) {
      throw new HttpException(
        { ok: false, message: 'Invalid or expired verification link' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (purpose && verificationToken.purpose !== purpose) {
      throw new HttpException(
        { ok: false, message: 'Invalid purpose for the provided token' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userService.findById(verificationToken.userId);

    if (verificationToken.expiresAt < new Date()) {
      // The "+3 days" soft window kept for backwards compatibility with the
      // legacy forgot-password flow that surfaces an "EXPIRED" UI state.
      const softWindow = new Date(verificationToken.expiresAt);
      softWindow.setDate(softWindow.getDate() + 3);
      if (softWindow < new Date()) {
        await this.prisma.magicLink.deleteMany({ where: { key: token } });
      }

      throw new HttpException(
        {
          ok: false,
          message: 'Verification link has expired',
          code: 'EXPIRED',
          data: { id: user?.id, email: user?.email },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      ok: true,
      data: { name: user?.email },
    };
  }
}
