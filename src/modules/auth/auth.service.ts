import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Global,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response, CookieOptions } from 'express';
import * as bcrypt from 'bcrypt';
import { LoggerService } from 'src/common/logger/logger.service';
import { UsersService } from '../users/user.service';
import { LoginRequestDto } from './dtos/login.dto';
import { RegisterRequestDto } from './dtos/register.dto';
import { ForgotPasswordRequestDto } from './dtos/forgot-password.dto';
import { MagicLinkService, MagicLinkPurpose } from './magic-link.service';
import { ResetPasswordRequestDto } from './dtos/reset-password.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Global()
@Injectable()
export class AuthService {
  private readonly context = 'AuthService';

  constructor(
    private readonly configService: ConfigService,
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => MagicLinkService))
    private readonly magicLinkService: MagicLinkService,
    private readonly logger: LoggerService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(this.context);
  }

  private getCookieSettings(): Record<string, CookieOptions> {
    // const isProduction = this.configService.get('NODE_ENV') === 'production';
    // const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    return {
      token: {
        httpOnly: true,
        path: '/',
        maxAge: this.configService.get('COOKIE_EXPIRES_IN') || 604800000,
        sameSite: 'none',
        secure: true,
      },
      isLoggedIn: {
        httpOnly: false,
        path: '/',
        maxAge: this.configService.get('COOKIE_EXPIRES_IN') || 604800000,
        sameSite: 'none',
        secure: true,
      },
    };
  }

  generateResponseTokens(response: Response, token: string) {
    const cookieSettings = this.getCookieSettings();
    response.cookie('token', token, cookieSettings.token);
    response.cookie('isLoggedIn', 'true', cookieSettings.isLoggedIn);
  }

  signToken(userId: string): string {
    this.logger.debug(`Generating JWT token for user ID: ${userId}`);
    const payload = {
      sub: userId,
    };

    return this.jwt.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });
  }

  verifyToken(token: string): Record<string, string> {
    return this.jwt.verify(token, {
      secret: this.configService.get('JWT_SECRET'),
    });
  }

  async login(data: LoginRequestDto) {
    this.logger.log(`Login attempt for user: ${data.email}`);

    const user = await this.usersService.findByEmail(data.email);

    if (!user) {
      this.logger.warn(`Login failed: User not found - ${data.email}`);
      throw new NotFoundException('User not found');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      this.logger.warn(`Login failed: Invalid password for user ${data.email}`);
      throw new UnauthorizedException('Invalid password');
    }

    if (!user.emailVerified) {
      this.logger.warn(
        `Login blocked: email not verified for user ${data.email}`,
      );
      throw new ForbiddenException({
        ok: false,
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    this.logger.log(`User ${data.email} logged in successfully`);
    const token = this.signToken(user.id);

    return token;
  }

  logout(res: Response) {
    res.clearCookie('token', this.getCookieSettings().token);
    res.clearCookie('isLoggedIn', this.getCookieSettings().isLoggedIn);
  }

  async register(dto: RegisterRequestDto): Promise<{ email: string }> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    this.logger.log(`Register attempt for user: ${dto.email}`);
    if (existingUser) {
      this.logger.warn(`Register failed: Email already in use - ${dto.email}`);
      throw new ConflictException('Email is already in use');
    }

    this.logger.debug(`Creating user with email: ${dto.email}`);

    const user = await this.usersService.create({
      name: dto.username,
      email: dto.email,
      password: dto.password,
    });

    await this.magicLinkService.sendVerificationLink({
      to: user.email,
      userId: user.id,
      purpose: MagicLinkPurpose.EMAIL_VERIFICATION,
    });

    this.logger.log(
      `User ${user.email} registered; verification email dispatched`,
    );

    return { email: user.email };
  }

  async verifyEmail(token: string): Promise<{ email: string }> {
    const result = await this.magicLinkService.verifyToken(
      token,
      MagicLinkPurpose.EMAIL_VERIFICATION,
    );

    const user = await this.usersService.findById(result.data.userId);

    if (user.emailVerified) {
      this.logger.log(
        `Email re-verification for already-verified user ${user.email}`,
      );
      return { email: user.email };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(`Email verified for user ${user.email}`);
    return { email: user.email };
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Silently no-op for unknown emails / already-verified users to avoid
    // user-enumeration via timing or response-shape differences.
    if (!user || user.emailVerified) {
      this.logger.debug(
        `Resend verification: no-op for email=${email} (` +
          `${!user ? 'unknown' : 'already verified'})`,
      );
      return;
    }

    await this.magicLinkService.sendVerificationLink({
      to: user.email,
      userId: user.id,
      purpose: MagicLinkPurpose.EMAIL_VERIFICATION,
    });

    this.logger.log(`Re-dispatched verification email to ${user.email}`);
  }

  async requestForgotPassword(data: ForgotPasswordRequestDto) {
    const user = await this.usersService.findByEmail(data.email);

    if (user) {
      await this.magicLinkService.sendVerificationLink({
        to: user.email,
        userId: user.id,
        purpose: MagicLinkPurpose.FORGOT_PASSWORD,
      });

      this.logger.log(`Password reset link queued for ${user.email}`);
    } else {
      this.logger.warn(
        `Forgot password request for non-existing email: ${data.email}`,
      );
    }

    // Always return the same response regardless of whether the user
    // exists, to avoid email enumeration. We also never include the
    // token here — it must only be transmitted via the email channel.
    return {
      ok: true,
      message:
        'If an account exists for this email, a password reset link has been sent.',
      data: null,
    };
  }

  async resetPassword(data: ResetPasswordRequestDto) {
    this.logger.debug(`Reset token received: ${data.token}`);

    const verificationToken = await this.magicLinkService.verifyToken(
      data.token,
      MagicLinkPurpose.FORGOT_PASSWORD,
    );

    if (!verificationToken.ok) {
      this.logger.warn(`Reset password failed: Invalid or expired token`);
      throw new HttpException(
        { ok: false, message: 'Invalid or expired token' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.usersService.findById(
      verificationToken.data.userId,
    );
    if (!user) {
      this.logger.warn(`Reset password failed: User not found for token`);
      throw new HttpException(
        { ok: false, message: 'User not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (data.password !== data.confirmPassword) {
      throw new HttpException(
        { ok: false, message: 'Passwords do not match' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Optionally add password strength check here

    await this.usersService.updatePassword(user.id, data.password);

    this.logger.log(`Password reset successful for user: ${user.email}`);

    return {
      ok: true,
      message: 'Password reset successful',
    };
  }
}
