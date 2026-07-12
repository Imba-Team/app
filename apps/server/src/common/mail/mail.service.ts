import { Injectable, OnModuleInit } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as sendgrid from '@sendgrid/mail';
import { LoggerService } from '../logger/logger.service';
import { MailJobPayload } from 'src/common/queue/queue.constants';

type Transport = 'sendgrid' | 'smtp' | 'noop';

/**
 * MailService is a transport-aware delivery layer.
 *
 * Transport selection at boot:
 *   - SENDGRID_API_KEY set         → SendGrid HTTP API (production default)
 *   - Otherwise, MAIL_HOST set     → SMTP via @nestjs-modules/mailer (dev)
 *   - Otherwise                    → noop with warning (CI / no-email envs)
 *
 * The `MailQueue → MailProcessor → MailService.deliver()` chain ensures
 * delivery happens off the request path, with BullMQ-driven retries.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly context = 'MailService';
  private transport: Transport = 'noop';
  private fromAddress = '';

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(this.context);
  }

  onModuleInit(): void {
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');
    const smtpHost = this.configService.get<string>('MAIL_HOST');
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ??
      this.configService.get<string>('NO_REPLY_MAIL') ??
      '';

    if (!this.fromAddress) {
      this.logger.warn(
        'Neither MAIL_FROM nor NO_REPLY_MAIL is set — outbound mail will be ' +
          'rejected by the transport at send time.',
      );
    }

    if (sendgridKey) {
      sendgrid.setApiKey(sendgridKey);
      this.transport = 'sendgrid';
      this.logger.log('Mail transport: SendGrid HTTP API');
      return;
    }

    if (smtpHost) {
      this.transport = 'smtp';
      this.logger.log(`Mail transport: SMTP (${smtpHost})`);
      return;
    }

    this.transport = 'noop';
    this.logger.warn(
      'Mail transport: NOOP — no SENDGRID_API_KEY or MAIL_HOST configured. ' +
        'Outbound emails will be logged but not delivered.',
    );
  }

  /**
   * Delivery entry point — called by MailProcessor for each dequeued job.
   * Returns true on success, false on a (retryable) failure.
   *
   * Throwing inside the worker triggers BullMQ backoff/retry; returning
   * false also does. We use `return false` for clean failures (bad config,
   * non-2xx HTTP) and let unexpected exceptions bubble for visibility.
   */
  async deliver(payload: MailJobPayload): Promise<boolean> {
    if (!this.fromAddress) {
      this.logger.error('Refusing to send mail: no from-address configured.');
      return false;
    }

    switch (this.transport) {
      case 'sendgrid':
        return this.deliverViaSendGrid(payload);
      case 'smtp':
        return this.deliverViaSmtp(payload);
      case 'noop':
        this.logger.warn(
          `[NOOP] would send mail to=${payload.to} subject="${payload.subject}"`,
        );
        return true;
    }
  }

  /**
   * Legacy callsite shim — old code paths can keep calling sendMail() and
   * the request will be transparently dispatched via the configured transport.
   * NEW code should publish to MailQueueService instead so dispatch happens
   * off the request thread.
   */
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    return this.deliver({ ...options, context: 'legacy.sendMail' });
  }

  private async deliverViaSendGrid(payload: MailJobPayload): Promise<boolean> {
    try {
      const [response] = await sendgrid.send({
        to: payload.to,
        from: this.fromAddress,
        subject: payload.subject,
        html: payload.html,
      });
      const status = response.statusCode;
      if (status < 200 || status >= 300) {
        this.logger.error(
          `SendGrid returned non-2xx status=${status} to=${payload.to}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(this.describeError('SendGrid send error', err));
      return false;
    }
  }

  private async deliverViaSmtp(payload: MailJobPayload): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: payload.to,
        from: this.fromAddress,
        subject: payload.subject,
        html: payload.html,
      });
      return true;
    } catch (err) {
      this.logger.error(this.describeError('SMTP send error', err));
      return false;
    }
  }

  private describeError(prefix: string, err: unknown): string {
    if (err instanceof Error) {
      return `${prefix}: ${err.message}\n${err.stack ?? ''}`;
    }
    return `${prefix}: Unknown error type: ${JSON.stringify(err)}`;
  }
}
