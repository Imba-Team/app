import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SEARCH_SYNC_QUEUE } from 'src/common/queue/queue.constants';
import { UsersController } from './user.controller';
import { AdminUsersController } from './admin-user.controller';
import { PublicUserController } from './public-user.controller';
import { UsersService } from './user.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    // Account deletion unpublishes the user's sets. SearchModule depends
    // on UsersModule, so enqueue onto its queue directly instead of
    // importing SearchSyncService (which would be a module cycle).
    BullModule.registerQueue({ name: SEARCH_SYNC_QUEUE }),
  ],
  // Order matters: UsersController declares /users/me / /users/me/* routes,
  // PublicUserController declares /users/:username. Declaring UsersController
  // first ensures /users/me resolves to the authenticated handler instead
  // of being intercepted by the public :username route matcher.
  controllers: [UsersController, AdminUsersController, PublicUserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
