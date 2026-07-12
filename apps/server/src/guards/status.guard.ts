import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthRequest } from 'src/common/interfaces/auth.interface';

@Injectable()
export class StatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (user.status === 'inactive') {
      throw new HttpException(
        {
          ok: false,
          message: 'Your account has been deactivated. Access denied.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
