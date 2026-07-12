// TODO: Refactor to use Passport JWT strategy for better integration
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { UsersService } from 'src/modules/users/user.service';

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly context = 'JwtGuard';

  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.token;

    if (!token) {
      this.logger.warn('Authentication attempt without token');
      throw new HttpException(
        {
          ok: false,
          message: 'No token provided',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const decoded = this.authService.verifyToken(token);
      this.logger.debug(`Token verified for user ID: ${decoded.sub}`);

      const user = await this.userService.findById(decoded.sub);

      if (!user) {
        this.logger.warn(`User not found for token with ID: ${decoded.sub}`);
        throw new HttpException(
          {
            ok: false,
            message: 'User not found',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Attach user to request object
      request.user = user;

      return true;
    } catch (error) {
      this.logger.error('Token verification failed', error.stack);
      console.log('Error details:', error);
      throw new HttpException(
        {
          ok: false,
          message: 'Invalid token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
