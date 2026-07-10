import type { JobName } from '@app/types';

/** Typed payloads for each durable job. Content is derived from the DB at run
 *  time (e.g. outbound-email carries only an id), so payloads stay small and
 *  jobs remain idempotent on retry. */
export interface SerializedInboundEmail {
  messageId: string;
  inReplyTo?: string;
  references: string[];
  from: string;
  subject: string;
  text: string;
  receivedAtISO: string;
}

export interface JobPayloads {
  'daily-sweep': { runDateISO: string };
  'outbound-email': { emailLogId: string };
  'inbound-poll': { since?: string };
  'process-inbound': SerializedInboundEmail;
}

export interface EnqueueOptions {
  /** Dedup: at most one active job with this key (idempotent enqueue). */
  singletonKey?: string;
  /** Debounce window in seconds for the singleton key. */
  singletonSeconds?: number;
  /** Delay start until this time / N seconds from now. */
  startAfter?: Date | number;
  retryLimit?: number;
  retryDelaySeconds?: number;
  retryBackoff?: boolean;
  priority?: number;
}

/**
 * Abstracts the durable queue (pg-boss on Postgres). Kept minimal so a BullMQ /
 * Redis implementation could be dropped in behind the same interface without
 * touching business code.
 */
export interface QueuePort {
  enqueue<K extends JobName>(
    name: K,
    data: JobPayloads[K],
    opts?: EnqueueOptions,
  ): Promise<string | null>;

  schedule<K extends JobName>(
    name: K,
    cron: string,
    data: JobPayloads[K],
    timezone: string,
  ): Promise<void>;
}

export const QUEUE_PORT = Symbol('QUEUE_PORT');

/** Retry/backoff policy shared by producer (api) and consumer (worker).
 *  ~30s, 60s, 120s, 240s, 480s then the job moves to its dead-letter queue. */
export const DEFAULT_JOB_RETRY = {
  retryLimit: 5,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInMinutes: 15,
} as const;

/** All durable queue names, including their dead-letter companions. */
export const QUEUE_NAMES = {
  DAILY_SWEEP: 'daily-sweep',
  OUTBOUND_EMAIL: 'outbound-email',
  INBOUND_POLL: 'inbound-poll',
  PROCESS_INBOUND: 'process-inbound',
} as const;

export const DLQ_SUFFIX = '.dlq';
