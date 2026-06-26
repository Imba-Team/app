// auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthHealthController } from './auth-health.controller';
import { MagicLinkService } from './magic-link.service';
import { LoginAttemptsService } from './login-attempts.service';
import { MailModule } from 'src/common/mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/user.module';
import { loadJwtKeyPair } from 'src/common/jwt/key-loader';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const keys = loadJwtKeyPair(cfg);
        const issuer = cfg.get<string>('JWT_ISSUER') ?? 'mimir-api';
        return {
          privateKey: keys.privateKey,
          publicKey: keys.publicKey,
          signOptions: {
            algorithm: 'RS256',
            expiresIn: cfg.get<string>('JWT_ACCESS_TTL') ?? '15m',
            issuer,
          },
          verifyOptions: {
            algorithms: ['RS256'],
            issuer,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, AuthHealthController],
  providers: [AuthService, MagicLinkService, LoginAttemptsService],
  exports: [AuthService, MagicLinkService],
})
export class AuthModule {}
