import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { MailQueueService } from './mail-queue.service';

@Module({
  imports: [
    ConfigModule,
    // SMTP transport (development fallback). When SENDGRID_API_KEY is set
    // the MailService bypasses MailerService entirely and uses the
    // SendGrid HTTP API instead, but we still construct the SMTP client
    // so dev environments work without code changes.
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        transport: {
          host: cfg.get<string>('MAIL_HOST') ?? 'localhost',
          port: cfg.get<number>('MAIL_PORT') ?? 1025,
          secure: cfg.get<boolean>('MAIL_SECURE') ?? false,
          auth: cfg.get<string>('MAIL_USER')
            ? {
                user: cfg.get<string>('MAIL_USER'),
                pass: cfg.get<string>('MAIL_PASSWORD'),
              }
            : undefined,
        },
        defaults: {
          from:
            cfg.get<string>('MAIL_FROM') ??
            cfg.get<string>('NO_REPLY_MAIL') ??
            'no-reply@mimir.local',
        },
      }),
    }),
  ],
  providers: [MailService, MailQueueService, MailProcessor],
  exports: [MailService, MailQueueService, MailerModule],
})
export class MailModule {}
