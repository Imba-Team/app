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
