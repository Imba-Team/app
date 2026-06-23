// auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthHealthController } from './auth-health.controller';
import { MagicLinkService } from './magic-link.service';
import { MailService } from 'src/common/mail/mail.service';
import { MailModule } from 'src/common/mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/user.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController, AuthHealthController],
  providers: [AuthService, MagicLinkService, MailService, MailModule],
  exports: [AuthService, MailModule, MagicLinkService],
})
export class AuthModule {}
