import {
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleOauthConfigured } from 'src/modules/auth/google-oauth20/google.strategy';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  constructor(private readonly cfg: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!isGoogleOauthConfigured(this.cfg)) {
      throw new NotFoundException('Google OAuth is not configured');
    }
    return super.canActivate(context);
  }
}
