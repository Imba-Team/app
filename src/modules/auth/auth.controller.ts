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
import { Response, Request } from 'express';

import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dtos/login.dto';
import { RegisterRequestDto } from './dtos/register.dto';
import { GoogleOauthGuard } from 'src/guards/google.guard';
import { ForgotPasswordRequestDto } from './dtos/forgot-password.dto';
import { ResetPasswordRequestDto } from './dtos/reset-password.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      example: {
        ok: true,
        message: 'Registration successful',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 500, description: 'Server error' })
  async register(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: RegisterRequestDto,
  ): Promise<ResponseDto<null>> {
    const authTokens = await this.authService.register(dto);
    this.authService.generateResponseTokens(response, authTokens);

    return {
      ok: true,
      message: 'Registration successful',
      data: null,
    };
  }

  @Post('login')
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
    @Res({ passthrough: true }) response: Response,
    @Body() data: LoginRequestDto,
  ): Promise<ResponseDto<null>> {
    const token = await this.authService.login(data);
    this.authService.generateResponseTokens(response, token);

    return {
      ok: true,
      message: 'Login successful',
      data: null,
    };
  }

  @Post('forgot-password')
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
  ): Promise<ResponseDto<any>> {
    const result = await this.authService.requestForgotPassword(data);

    return {
      ok: result.ok,
      message: result.message,
      data: result.data,
    };
  }

  @Post('reset-password')
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
  logout(@Res({ passthrough: true }) res: Response): ResponseDto<null> {
    this.authService.logout(res);

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
    const token = await this.authService.login(req.user);

    res.cookie('access_token', token, {
      maxAge: 2592000000,
      httpOnly: true,
      sameSite: true,
      secure: this.configService.get('NODE_ENV') === 'production',
    });

    return {
      ok: true,
      message: 'Authentication successful',
      data: null,
    };
  }
}
