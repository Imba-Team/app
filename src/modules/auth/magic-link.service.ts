import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  // LoggerService,
} from '@nestjs/common';
import { UsersService } from '../users/user.service';
import { MailService } from 'src/common/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

interface SendVerificationParams {
  to: string;
  userId: string;
  purpose: string;
}

@Injectable()
export class MagicLinkService {
  constructor(
    private readonly userService: UsersService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private generateVerificationToken(purpose: string): string {
    return `${purpose}-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`;
  }

  async sendVerificationLink({ to, userId, purpose }: SendVerificationParams) {
    const token = this.generateVerificationToken(purpose);
    const baseUrl: string =
      this.config.get<string>('BASE_URL') || 'http://localhost:3000';

    await this.prisma.magicLink.deleteMany({
      where: { userId, purpose },
    });

    const magicLink = await this.prisma.magicLink.create({
      data: {
        key: token,
        userId,
        purpose,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const verificationLink = `${baseUrl}/auth/${purpose.toLowerCase()}/verify?token=${token}`;

    // Send email
    await this.mailService.sendMail({
      to,
      subject: `${purpose} Verification`,
      html: `
          <h1>${purpose} Verification</h1>
          <p>Please click the link below to verify your ${purpose.toLowerCase()}:</p>
          <a href="${verificationLink}" target="_blank">${verificationLink}</a>
          <p>This link will expire in 15 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
        `,
    });

    return {
      ok: true,
      message: 'Verification link sent successfully',
      data: {
        token,
        expiresAt: magicLink.expiresAt,
      },
    };
  }

  async getToken(token: string, purpose?: string) {
    const verificationToken = await this.prisma.magicLink.findUnique({
      where: { key: token },
    });

    if (!verificationToken) {
      throw new HttpException(
        {
          ok: false,
          message: 'Invalid or expired verification link',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (purpose && verificationToken.purpose !== purpose) {
      throw new HttpException(
        {
          ok: false,
          message: 'Invalid purpose for the provided token',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userService.findById(verificationToken.userId);

    if (!user) {
      throw new HttpException(
        {
          ok: false,
          message: 'User not found for the provided token',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // TODO: Why do we add 3 days to the expiration date?
    const expirationDate = new Date(verificationToken.expiresAt);
    expirationDate.setDate(expirationDate.getDate() + 3);

    // TODO: Instead, consider scheduling cleanup or a cron job for expired tokens rather than doing it inside a request
    if (verificationToken.expiresAt < new Date()) {
      if (expirationDate < new Date()) {
        await this.prisma.magicLink.deleteMany({ where: { key: token } });
      }

      throw new HttpException(
        {
          ok: false,
          message: 'Verification link has expired',
          code: 'EXPIRED',
          data: {
            id: user?.id,
            email: user?.email,
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      ok: true,
      data: {
        name: user?.email,
      },
    };
  }

  async verifyToken(token: string, purpose: string) {
    this.logger.debug(`Verifying token: ${token} for purpose: ${purpose}`);

    const verificationToken = await this.prisma.magicLink.findFirst({
      where: {
        key: token,
        purpose,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      this.logger.warn('Token not found or expired');
      throw new HttpException(
        {
          ok: false,
          message: 'Invalid or expired verification link',
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
}
