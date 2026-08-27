import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { AdminUsersController } from './admin-user.controller';
import { PublicUserController } from './public-user.controller';
import { UsersService } from './user.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  // Order matters: UsersController declares /users/me / /users/me/* routes,
  // PublicUserController declares /users/:username. Declaring UsersController
  // first ensures /users/me resolves to the authenticated handler instead
  // of being intercepted by the public :username route matcher.
  controllers: [UsersController, AdminUsersController, PublicUserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
