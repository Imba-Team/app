import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

export interface GoogleProfilePayload {
  providerId: string;
  email: string;
  displayName?: string;
  picture?: string;
}

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
    // gracefully.
    super({
      clientID: cfg.get<string>('GOOGLE_CLIENT_ID') || 'disabled',
      clientSecret: cfg.get<string>('GOOGLE_CLIENT_SECRET') || 'disabled',
      callbackURL:
        cfg.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  /**
   * Passport calls this with the Google profile. We resolve / link / create
   * the local user here so the rest of the auth flow can treat Google
   * sessions identically to password sessions.
   *
   * Edge cases handled:
   *  - First-ever Google sign-in: creates a user, marks email verified.
   *  - Existing email/password account, no linked Google id: silently
   *    links Google to that account (the email is verified by Google).
   *  - Existing Google id: re-uses the same user.
   */
  async validate(
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

      const user = await this.authService.resolveGoogleUser(payload);
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
