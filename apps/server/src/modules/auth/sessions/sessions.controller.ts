import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { AuthService } from '../auth.service';
import { SessionsService } from './sessions.service';
import { RevokeSessionResponseDto, SessionDto } from './dtos/session.dto';

interface AuthedRequest extends Request {
  user: { id: string };
  sessionId?: string;
}

@Controller('auth/sessions')
@ApiTags('Authentication')
@UseGuards(JwtGuard)
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the authenticated user\'s active sessions',
    description:
      'One entry per refresh-token family. The entry marked isCurrent=true ' +
      'is the caller\'s own device.',
  })
  @ApiResponse({ status: 200, type: SessionDto, isArray: true })
  async list(@Req() req: AuthedRequest): Promise<ResponseDto<SessionDto[]>> {
    const rows = await this.sessions.list(req.user.id, req.sessionId);
    return {
      ok: true,
      message: 'Sessions retrieved',
      data: rows.map((r) => ({
        id: r.id,
        userAgent: r.userAgent,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        isCurrent: r.isCurrent,
      })),
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoke a session by id',
    description:
      'Invalidates the refresh-token family so the device can no longer ' +
      'renew its access token. The current access token (if any) will ' +
      'expire naturally within JWT_ACCESS_TTL (default 15 minutes). ' +
      'If the caller revokes their own session, the response cookies are ' +
      'cleared and wasCurrent is true.',
  })
  @ApiResponse({ status: 200, type: RevokeSessionResponseDto })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revoke(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ResponseDto<RevokeSessionResponseDto>> {
    const { wasCurrent } = await this.sessions.revoke(
      req.user.id,
      id,
      req.sessionId,
    );

    if (wasCurrent) {
      this.authService.clearSessionCookies(res);
    }

    return {
      ok: true,
      message: wasCurrent ? 'Current session revoked' : 'Session revoked',
      data: { wasCurrent },
    };
  }
}
