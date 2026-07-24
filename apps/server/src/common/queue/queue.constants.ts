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

export const SEARCH_SYNC_QUEUE = 'search-sync';

export const SearchSyncJob = {
  INDEX_SET: 'search.index_set',
  DELETE_SET: 'search.delete_set',
} as const;

export type SearchSyncJobName =
  (typeof SearchSyncJob)[keyof typeof SearchSyncJob];

export interface SearchSyncJobPayload {
  setId: string;
}

export const SRS_REMINDERS_QUEUE = 'srs-reminders';

export const SrsRemindersJob = {
  /**
   * Nightly fan-out: scan users with cards due today and enqueue a per-user
   * reminder job. Registered as a repeatable job at boot.
   */
  SCHEDULE_DAILY: 'srs.schedule_daily',
  /** Per-user reminder — Sprint 7 will consume this via the notifications module. */
  REMIND_USER: 'srs.remind_user',
} as const;

export type SrsRemindersJobName =
  (typeof SrsRemindersJob)[keyof typeof SrsRemindersJob];

export interface SrsRemindUserPayload {
  userId: string;
  dueCount: number;
}
