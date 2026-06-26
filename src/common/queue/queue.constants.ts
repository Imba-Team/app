export const MAIL_QUEUE = 'mail';

export const MailJob = {
  SEND: 'mail.send',
} as const;

export type MailJobName = (typeof MailJob)[keyof typeof MailJob];

export interface MailJobPayload {
  to: string;
  subject: string;
  html: string;
  /** Free-form tag for log/Prometheus correlation. */
  context?: string;
}
