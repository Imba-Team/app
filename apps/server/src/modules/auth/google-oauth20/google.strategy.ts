import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Request } from 'express';
import { AuthService } from '../auth.service';

export interface GoogleProfilePayload {
  providerId: string;
  email: string;
  displayName?: string;
  picture?: string;
}

/**
 * What the guard hands off to the controller via `req.user`.
 *
 * - `mode: 'login'`  → the strategy resolved / created / linked the user
 *                      by email match (standard sign-in flow).
 * - `mode: 'link'`   → the caller was already signed in and clicked
 *                      "Connect Google"; the strategy skipped the DB
 *                      resolve step so the controller can attach Google
 *                      to the intended account instead.
 */
export type GoogleAuthResult =
  | { mode: 'login'; user: { id: string; email: string } }
  | { mode: 'link'; linkUserId: string; profile: GoogleProfilePayload };

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    cfg: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    // passport-google-oauth20 throws at construction time if any of the
    // three options are falsy. We tolerate missing env (so the app can
    // boot for dev / OpenAPI generation / tests without a Google
    // project) by passing harmless placeholders; the GoogleOauthGuard
    // would still bounce real requests to a non-existent Google app
    // gracefully. In production we hard-fail instead so a missing env
    // doesn't silently ship a broken localhost callback URL to users.
    const clientId = cfg.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = cfg.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = cfg.get<string>('GOOGLE_CALLBACK_URL');
    if (process.env.NODE_ENV === 'production') {
      if (!clientId || !clientSecret || !callbackURL) {
        throw new Error(
          'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, ' +
            'GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in production.',
        );
      }
    }
    super({
      clientID: clientId || 'disabled',
      clientSecret: clientSecret || 'disabled',
      callbackURL: callbackURL || 'http://localhost/auth/google/callback',
      scope: ['profile', 'email'],
      // Needed so we can inspect the link-intent cookie on the callback
      // and branch between login vs. account-link handling.
      passReqToCallback: true,
    });
  }

  /**
   * Passport calls this with the Google profile. Behaviour:
   *
   *  - Link mode (caller has a valid `google_link_intent` cookie):
   *    return the raw profile + intent userId. The controller performs
   *    the actual DB attach so email-based resolution doesn't get in
   *    the way (e.g. connecting a Google account whose email differs
   *    from the signed-in user's).
   *
   *  - Login mode (no intent cookie or expired): resolve / link / create
   *    the local user by email match, same as before.
   */
  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(
          new Error('Google profile did not include an email address'),
          false,
        );
      }

      const payload: GoogleProfilePayload = {
        providerId: profile.id,
        email,
        displayName: profile.displayName,
        picture: profile.photos?.[0]?.value,
      };

      const linkUserId = this.authService.readGoogleLinkIntent(req);
      if (linkUserId) {
        const result: GoogleAuthResult = {
          mode: 'link',
          linkUserId,
          profile: payload,
        };
        done(null, result);
        return;
      }

      const user = await this.authService.resolveGoogleUser(payload);
      const result: GoogleAuthResult = {
        mode: 'login',
        user: { id: user.id, email: user.email },
      };
      done(null, result);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
