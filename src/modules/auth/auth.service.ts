import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Global,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, CookieOptions } from 'express';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoggerService } from 'src/common/logger/logger.service';
import { UsersService } from '../users/user.service';
import { LoginRequestDto } from './dtos/login.dto';
import { RegisterRequestDto } from './dtos/register.dto';
import { ForgotPasswordRequestDto } from './dtos/forgot-password.dto';
import { MagicLinkService, MagicLinkPurpose } from './magic-link.service';
import { ResetPasswordRequestDto } from './dtos/reset-password.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { LoginAttemptsService } from './login-attempts.service';

export const ACCESS_COOKIE = 'token';
export const REFRESH_COOKIE = 'refresh_token';
export const HINT_COOKIE = 'isLoggedIn';
export const REFRESH_COOKIE_PATH = '/auth/refresh';

interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  userId: string;
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

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
    private readonly loginAttempts: LoginAttemptsService,
  ) {
    this.logger.setContext(this.context);
  }

  // ============================================================
  //                       Cookie strategy
  // ============================================================

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private accessCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: '/',
      maxAge: this.accessTtlMs(),
      sameSite: this.isProduction() ? 'none' : 'lax',
      secure: this.isProduction(),
    };
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Restrict the refresh cookie to the refresh endpoint to minimise
      // CSRF surface — it is never sent on any other request.
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshTtlMs(),
      sameSite: this.isProduction() ? 'none' : 'lax',
      secure: this.isProduction(),
    };
  }

  private hintCookieOptions(): CookieOptions {
    return {
      httpOnly: false,
      path: '/',
      maxAge: this.refreshTtlMs(),
      sameSite: this.isProduction() ? 'none' : 'lax',
      secure: this.isProduction(),
    };
  }

  private setSessionCookies(res: Response, session: IssuedSession): void {
    res.cookie(ACCESS_COOKIE, session.accessToken, this.accessCookieOptions());
    res.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      this.refreshCookieOptions(),
    );
    res.cookie(HINT_COOKIE, 'true', this.hintCookieOptions());
  }

  clearSessionCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.accessCookieOptions());
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
    res.clearCookie(HINT_COOKIE, this.hintCookieOptions());
  }

  // ============================================================
  //                      Token issuance
  // ============================================================

  private accessTtlMs(): number {
    return parseDurationToMs(
      this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
  }

  private refreshTtlMs(): number {
    const days =
      Number(this.configService.get<string>('JWT_REFRESH_TTL_DAYS')) || 30;
    return days * 24 * 60 * 60 * 1000;
  }

  /** Sign an RS256 access token. Key + algorithm come from JwtModule. */
  issueAccessToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  /**
   * Mint a brand-new opaque refresh token, store the hash in the DB, and
   * return the raw value to the caller. The raw value is the only copy
   * that ever leaves this process — once the user logs out (or the row
   * is revoked) it cannot be reconstructed.
   */
  private async issueRefreshToken(
    userId: string,
    familyId: string,
    parentId: string | null,
    meta: RequestMeta,
  ): Promise<{ raw: string; expiresAt: Date }> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(raw);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        parentId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { raw, expiresAt };
  }

  /** Issue a fresh access + refresh pair for a new login. */
  private async issueSession(
    userId: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const familyId = crypto.randomUUID();
    const { raw, expiresAt } = await this.issueRefreshToken(
      userId,
      familyId,
      null,
      meta,
    );
    return {
      userId,
      accessToken: this.issueAccessToken(userId),
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
    };
  }

  // ============================================================
  //                      Token verification
  // ============================================================

  /** Verify an RS256 access token. Throws if invalid/expired/wrong issuer. */
  verifyAccessToken(token: string): Record<string, string> {
    return this.jwt.verify(token);
  }

  /** Backwards-compat alias for the old JwtGuard call site. */
  verifyToken(token: string): Record<string, string> {
    return this.verifyAccessToken(token);
  }

  /** Backwards-compat alias for the old signToken() call sites. */
  signToken(userId: string): string {
    return this.issueAccessToken(userId);
  }

  // ============================================================
  //                  Refresh-token rotation
  // ============================================================

  /**
   * Consume a refresh token and produce a new access + refresh pair.
   *
   * Replay protection:
   *  - Tokens are single-use. The matching DB row is revoked on every
   *    consumption.
   *  - If a token is presented that is already revoked, the entire token
   *    family is invalidated (this is the canonical "rotation detected
   *    on replay" pattern). The caller is treated as compromised and
   *    must re-authenticate.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const tokenHash = sha256Hex(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      this.logger.warn('Refresh failed: token not found');
      throw new UnauthorizedException({
        ok: false,
        message: 'Refresh token invalid or expired',
        code: 'REFRESH_INVALID',
      });
    }

    if (existing.revokedAt) {
      this.logger.error(
        `Refresh-token replay detected — revoking family ${existing.familyId} ` +
          `for user ${existing.userId}`,
      );
      await this.revokeRefreshTokenFamily(existing.familyId);
      throw new UnauthorizedException({
        ok: false,
        message:
          'Refresh token replay detected. All sessions have been revoked.',
        code: 'REFRESH_REPLAY',
      });
    }

    if (existing.expiresAt <= new Date()) {
      this.logger.warn('Refresh failed: token expired');
      throw new UnauthorizedException({
        ok: false,
        message: 'Refresh token invalid or expired',
        code: 'REFRESH_INVALID',
      });
    }

    // Issue the new refresh token first so we can record its id on the
    // outgoing row in a single transaction.
    const { raw: newRaw, expiresAt: newExpiresAt } =
      await this.issueRefreshToken(
        existing.userId,
        existing.familyId,
        existing.id,
        meta,
      );
    const newRow = await this.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(newRaw) },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: newRow.id,
      },
    });

    this.logger.log(
      `Rotated refresh token family=${existing.familyId} user=${existing.userId}`,
    );

    return {
      userId: existing.userId,
      accessToken: this.issueAccessToken(existing.userId),
      refreshToken: newRaw,
      refreshExpiresAt: newExpiresAt,
    };
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ============================================================
  //                          Auth flows
  // ============================================================

  /**
   * Resolve a Google OAuth profile to a local User row, creating or
   * linking as needed. Called from GoogleStrategy.validate().
   *
   * Three branches:
   *   - googleProviderId already on file → reuse that user.
   *   - email matches an existing local user → silently link Google.
   *     The email is already verified by Google itself, so we accept
   *     this without a confirmation step.
   *   - neither matches → create a new account, password is a random
   *     unguessable placeholder (the user can set one later via the
   *     reset-password flow).
   */
  async resolveGoogleUser(profile: {
    providerId: string;
    email: string;
    displayName?: string;
    picture?: string;
  }) {
    const byProvider = await this.prisma.user.findUnique({
      where: { googleProviderId: profile.providerId },
    });
    if (byProvider) {
      return byProvider;
    }

    const byEmail = await this.usersService.findByEmail(profile.email);
    if (byEmail) {
      if (
        byEmail.googleProviderId &&
        byEmail.googleProviderId !== profile.providerId
      ) {
        // Two different Google subjects somehow claim the same email —
        // refuse rather than silently overwriting the link.
        throw new ConflictException({
          ok: false,
          message:
            'This email is already linked to a different Google account.',
          code: 'GOOGLE_LINK_CONFLICT',
        });
      }

      this.logger.log(
        `Linking Google providerId=${profile.providerId} to existing user ${byEmail.email}`,
      );
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleProviderId: profile.providerId,
          emailVerified: true,
          verifiedAt: byEmail.verifiedAt ?? new Date(),
          profilePicture: byEmail.profilePicture ?? profile.picture,
        },
      });
    }

    this.logger.log(`Creating new Google-only user for ${profile.email}`);
    const placeholderPassword = crypto.randomBytes(48).toString('base64url');
    const created = await this.usersService.create({
      email: profile.email,
      name: profile.displayName ?? profile.email.split('@')[0],
      password: placeholderPassword,
    });
    return this.prisma.user.update({
      where: { id: created.id },
      data: {
        googleProviderId: profile.providerId,
        emailVerified: true,
        verifiedAt: new Date(),
        profilePicture: profile.picture,
      },
    });
  }

  /**
   * Finalise a Google login: the user is already resolved by the
   * strategy, so we just need to issue a session and set cookies.
   */
  async loginViaGoogle(
    user: { id: string; email: string },
    req: Request,
  ): Promise<IssuedSession & { email: string }> {
    const session = await this.issueSession(user.id, readMeta(req));
    this.logger.log(`User ${user.email} logged in via Google`);
    return { ...session, email: user.email };
  }

  async login(
    data: LoginRequestDto,
    req: Request,
  ): Promise<IssuedSession & { email: string }> {
    this.logger.log(`Login attempt for user: ${data.email}`);

    // 1) Lockout check — throws 429 ACCOUNT_LOCKED if the account is
    //    currently in cooldown. Done before any DB / bcrypt work so
    //    locked accounts cannot be probed cheaply.
    await this.loginAttempts.assertNotLocked(data.email);

    const user = await this.usersService.findByEmail(data.email);

    // 2) Unify "user not found" and "wrong password" under one error
    //    response to avoid user-enumeration via login.
    if (!user) {
      await this.loginAttempts.recordFailure(data.email);
      this.logger.warn(
        `Login failed: invalid credentials (unknown email) - ${data.email}`,
      );
      throw new UnauthorizedException({
        ok: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);
    if (!passwordMatch) {
      await this.loginAttempts.recordFailure(data.email);
      this.logger.warn(
        `Login failed: invalid credentials (bad password) - ${data.email}`,
      );
      throw new UnauthorizedException({
        ok: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Email-not-verified is a *successful* auth result that is gated
    // behind a separate workflow — not a credential failure, so it
    // doesn't contribute to the lockout counter.
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

    await this.loginAttempts.recordSuccess(data.email);
    const session = await this.issueSession(user.id, readMeta(req));
    this.logger.log(`User ${data.email} logged in successfully`);
    return { ...session, email: user.email };
  }

  finalizeLogin(res: Response, session: IssuedSession): void {
    this.setSessionCookies(res, session);
  }

  async refresh(req: Request, res: Response): Promise<IssuedSession> {
    const raw = readRefreshCookie(req);
    if (!raw) {
      throw new UnauthorizedException({
        ok: false,
        message: 'No refresh token presented',
        code: 'REFRESH_MISSING',
      });
    }

    const session = await this.rotateRefreshToken(raw, readMeta(req));
    this.setSessionCookies(res, session);
    return session;
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = readRefreshCookie(req);
    if (raw) {
      const existing = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: sha256Hex(raw) },
      });
      if (existing && !existing.revokedAt) {
        await this.revokeRefreshTokenFamily(existing.familyId);
      }
    }
    this.clearSessionCookies(res);
  }

  // ============================================================
  //                     Registration + verify
  // ============================================================

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

  // ============================================================
  //                      Password reset
  // ============================================================

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

    return {
      ok: true,
      message:
        'If an account exists for this email, a password reset link has been sent.',
      data: null,
    };
  }

  async resetPassword(data: ResetPasswordRequestDto) {
    const verificationToken = await this.magicLinkService.verifyToken(
      data.token,
      MagicLinkPurpose.FORGOT_PASSWORD,
    );

    const user = await this.usersService.findById(
      verificationToken.data.userId,
    );
    if (!user) {
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

    await this.usersService.updatePassword(user.id, data.password);

    // Password change is a credential rotation event — invalidate every
    // active refresh-token family for the user.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset successful for user: ${user.email}`);
    return { ok: true, message: 'Password reset successful' };
  }
}

// ============================================================
//                      Module-private helpers
// ============================================================

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

function readMeta(req: Request): RequestMeta {
  const ua = req.get('user-agent') ?? undefined;
  const fwd = req.get('x-forwarded-for');
  const ip = (fwd?.split(',')[0]?.trim() || req.ip) ?? undefined;
  return { userAgent: ua, ipAddress: ip };
}

/**
 * Parse short duration strings like '15m', '2h', '7d', '900s' into
 * milliseconds. Falls back to 15 minutes on any parse failure to avoid
 * a misconfigured value silently issuing infinite-life tokens.
 */
function parseDurationToMs(input: string): number {
  const FIFTEEN_MIN = 15 * 60 * 1000;
  const match = /^\s*(\d+)\s*(ms|s|m|h|d)?\s*$/.exec(input);
  if (!match) return FIFTEEN_MIN;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return FIFTEEN_MIN;
  }
}
