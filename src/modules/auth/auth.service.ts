import {
  ConflictException,
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
import { MagicLinkService } from './magic-link.service';
import { ResetPasswordRequestDto } from './dtos/reset-password.dto';

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

    this.logger.log(`User ${data.email} logged in successfully`);
    const token = this.signToken(user.id);

    return token;
  }

  logout(res: Response) {
    res.clearCookie('token', this.getCookieSettings().token);
    res.clearCookie('isLoggedIn', this.getCookieSettings().isLoggedIn);
  }

  async register(dto: RegisterRequestDto): Promise<string> {
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

    this.logger.log(`User ${user.email} registered successfully`);

    const token = this.signToken(user.id);

    return token;
  }

  async requestForgotPassword(data: ForgotPasswordRequestDto) {
    const user = await this.usersService.findByEmail(data.email);

    if (user) {
      const result = await this.magicLinkService.sendVerificationLink({
        to: user.email,
        userId: user.id,
        purpose: 'forgot-password',
      });

      this.logger.log(`Verification link sent to ${user.email}`);

      return {
        ok: true,
        message: 'Verification link sent successfully',
        data: result.data, // contains token and expiresAt
      };
    }

    this.logger.warn(
      `Forgot password request for non-existing email: ${data.email}`,
    );

    return {
      ok: true,
      message:
        'If a user with this email exists, a verification link has been sent.',
      data: null,
    };
  }

  async resetPassword(data: ResetPasswordRequestDto) {
    this.logger.debug(`Reset token received: ${data.token}`);

    const verificationToken = await this.magicLinkService.verifyToken(
      data.token,
      'forgot-password',
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
