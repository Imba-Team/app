import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';

import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dtos/login.dto';
import { RegisterRequestDto } from './dtos/register.dto';
import { GoogleOauthGuard } from 'src/guards/google.guard';
import { ForgotPasswordRequestDto } from './dtos/forgot-password.dto';
import { ResetPasswordRequestDto } from './dtos/reset-password.dto';
import { VerifyEmailRequestDto } from './dtos/verify-email.dto';
import { ResendVerificationRequestDto } from './dtos/resend-verification.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';

// Sensitive auth endpoints are rate-limited per IP. The values here are
// conservative starting points — they sit on top of the per-account
// lockout in LoginAttemptsService for login, and provide standalone
// bot-spam protection for the email-dispatching routes.
const RATE_LOGIN = { default: { limit: 5, ttl: 60_000 } } as const;
const RATE_REFRESH = { default: { limit: 30, ttl: 60_000 } } as const;
const RATE_REGISTER = { default: { limit: 5, ttl: 60_000 } } as const;
const RATE_MAIL_DISPATCH = { default: { limit: 3, ttl: 60_000 } } as const;
const RATE_TOKEN_CONSUME = { default: { limit: 10, ttl: 60_000 } } as const;

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle(RATE_REGISTER)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates an unverified user and dispatches a verification email. ' +
      'The response is 202 Accepted with no session — the caller must ' +
      'verify their email and then log in.',
  })
  @ApiResponse({
    status: 202,
    description: 'Registration accepted; verification email dispatched',
    schema: {
      example: {
        ok: true,
        message: 'Verification email sent. Please check your inbox.',
        data: { email: 'john@example.com' },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 500, description: 'Server error' })
  async register(
    @Body() dto: RegisterRequestDto,
  ): Promise<ResponseDto<{ email: string }>> {
    const result = await this.authService.register(dto);

    return {
      ok: true,
      message: 'Verification email sent. Please check your inbox.',
      data: result,
    };
  }

  @Post('verify-email')
  @Throttle(RATE_TOKEN_CONSUME)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a registration via the email link token',
    description:
      'The frontend extracts the token from the URL query string of the ' +
      'email link and submits it here. On success the user is marked as ' +
      'verified and can subsequently log in.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified',
    schema: {
      example: {
        ok: true,
        message: 'Email verified successfully',
        data: { email: 'john@example.com' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Body() dto: VerifyEmailRequestDto,
  ): Promise<ResponseDto<{ email: string }>> {
    const result = await this.authService.verifyEmail(dto.token);

    return {
      ok: true,
      message: 'Email verified successfully',
      data: result,
    };
  }

  @Post('resend-verification')
  @Throttle(RATE_MAIL_DISPATCH)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Re-dispatch the email verification link',
    description:
      'Always returns 200 with a generic message regardless of whether the ' +
      'email exists or is already verified, to avoid user enumeration.',
  })
  @ApiResponse({
    status: 200,
    description:
      'If a matching unverified account exists, a new verification email ' +
      'was dispatched.',
    schema: {
      example: {
        ok: true,
        message:
          'If an unverified account exists for this email, a new ' +
          'verification link has been sent.',
        data: null,
      },
    },
  })
  async resendVerification(
    @Body() dto: ResendVerificationRequestDto,
  ): Promise<ResponseDto<null>> {
    await this.authService.resendVerification(dto.email);

    return {
      ok: true,
      message:
        'If an unverified account exists for this email, a new ' +
        'verification link has been sent.',
      data: null,
    };
  }

  @Post('login')
  @Throttle(RATE_LOGIN)
  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        ok: true,
        message: 'Login successful',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, description: 'Server error' })
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() data: LoginRequestDto,
  ): Promise<ResponseDto<null>> {
    const session = await this.authService.login(data, request);
    this.authService.finalizeLogin(response, session);

    return {
      ok: true,
      message: 'Login successful',
      data: null,
    };
  }

  @Post('refresh')
  @Throttle(RATE_REFRESH)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
    description:
      'Reads the refresh_token cookie, validates it, marks it used, ' +
      'issues a fresh access + refresh pair and sets both cookies. ' +
      'Implements single-use rotation: if the same refresh token is ' +
      'presented twice, the entire token family is revoked and the ' +
      'caller must reauthenticate.',
  })
  @ApiResponse({ status: 200, description: 'Tokens rotated' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token missing, expired, replayed, or revoked',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseDto<null>> {
    await this.authService.refresh(request, response);
    return {
      ok: true,
      message: 'Tokens refreshed',
      data: null,
    };
  }

  @Post('forgot-password')
  @Throttle(RATE_MAIL_DISPATCH)
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Verification link sent to your email',
    schema: {
      example: {
        ok: true,
        message: 'Password reset link sent to your email',
        data: null,
      },
    },
  })
  async forgotPassword(
    @Body() data: ForgotPasswordRequestDto,
  ): Promise<ResponseDto<null>> {
    const result = await this.authService.requestForgotPassword(data);

    return {
      ok: result.ok,
      message: result.message,
      data: null,
    };
  }

  @Post('reset-password')
  @Throttle(RATE_TOKEN_CONSUME)
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      example: {
        ok: true,
        message: 'Password has been reset successfully',
        data: null,
      },
    },
  })
  async resetPassword(
    @Body() data: ResetPasswordRequestDto,
  ): Promise<ResponseDto<null>> {
    const result = await this.authService.resetPassword(data);

    return {
      ok: result.ok,
      message: result.message,
      data: null,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: {
      example: {
        ok: true,
        message: 'Logout successful',
        data: null,
      },
    },
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ResponseDto<null>> {
    await this.authService.logout(req, res);

    return {
      ok: true,
      message: 'Logout successful',
      data: null,
    };
  }

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow' })
  @ApiResponse({ status: 200, description: 'Redirects to Google login' })
  async auth() {
    // Handled by GoogleOauthGuard middleware
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google',
    schema: {
      example: {
        ok: true,
        message: 'Authentication successful',
        data: null,
      },
    },
  })
  async googleAuthCallback(
    @Req() req: Request & { user: LoginRequestDto },
    @Res({ passthrough: true }) res: Response,
  ): Promise<ResponseDto<null>> {
    const session = await this.authService.login(req.user, req);
    this.authService.finalizeLogin(res, session);

    return {
      ok: true,
      message: 'Authentication successful',
      data: null,
    };
  }
}
