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
  /** Bring one set's search document in line with Postgres (index or delete). */
  SYNC_SET: 'search.sync_set',
  /** Legacy names — still processed so jobs queued before the switch drain. */
  INDEX_SET: 'search.index_set',
  DELETE_SET: 'search.delete_set',
} as const;

export type SearchSyncJobName =
  (typeof SearchSyncJob)[keyof typeof SearchSyncJob];

export interface SearchSyncJobPayload {
  setId: string;
}

/**
 * Job options for a set's sync job. One deduplication id per set:
 * - adds while a job is waiting fold into it (it reads Postgres when it runs)
 * - an add while a job is active queues exactly one follow-up
 *   (`keepLastIfActive`), so changes made mid-run aren't lost
 * - the key is cleared on completion, so the next change always syncs
 *
 * Don't use a fixed `jobId` here: BullMQ ignores adds while a job with
 * that id exists, and completed jobs are retained for 24h, so later
 * syncs were silently dropped (MIM-45).
 */
export const searchSyncJobOptions = (setId: string) => ({
  deduplication: { id: `set-${setId}`, keepLastIfActive: true },
});

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

export const ANALYTICS_QUEUE = 'analytics';

export const AnalyticsJob = {
  /**
   * Hourly fan-out: picks users whose local day just ended and enqueues
   * one snapshot job each. Registered as a repeatable job at boot.
   */
  SNAPSHOT_HOURLY: 'analytics.snapshot_hourly',
  /** Copy one user's per-set mastery counts into the snapshot table. */
  SNAPSHOT_USER: 'analytics.snapshot_user',
} as const;

export type AnalyticsJobName = (typeof AnalyticsJob)[keyof typeof AnalyticsJob];

export interface AnalyticsSnapshotUserPayload {
  userId: string;
  /** The user's local day being recorded, `YYYY-MM-DD`. */
  date: string;
}
