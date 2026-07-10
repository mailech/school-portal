import PgBoss from 'pg-boss';
import { DEFAULT_JOB_RETRY, DLQ_SUFFIX, QUEUE_NAMES } from '@app/core';

/** pg-boss connects via the pg driver; strip the Prisma-only `schema` query
 *  param so it doesn't confuse the connection (pg-boss uses its own schema). */
export function pgConnectionString(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export function createBoss(databaseUrl: string, schema: string): PgBoss {
  return new PgBoss({
    connectionString: pgConnectionString(databaseUrl),
    schema,
    // Housekeeping is driven by the worker; keep the producer lightweight.
    application_name: 'schoolportal-api',
    supervise: false,
  });
}

const ALL_QUEUES = [
  QUEUE_NAMES.DAILY_SWEEP,
  QUEUE_NAMES.OUTBOUND_EMAIL,
  QUEUE_NAMES.INBOUND_POLL,
  QUEUE_NAMES.PROCESS_INBOUND,
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries on Postgres deadlock (40P01) — api and worker may create the same
 *  queues concurrently at boot, which briefly contends on pgboss catalog locks. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if ((code === '40P01' || code === '40001') && i < attempts - 1) {
        await sleep(100 + i * 150);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Idempotently creates every queue plus its dead-letter companion, with the
 * shared retry/backoff policy. Safe to call from both api and worker on boot.
 */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of ALL_QUEUES) {
    const dlq = `${name}${DLQ_SUFFIX}`;
    await withRetry(() => boss.createQueue(dlq, { name: dlq }));
    await withRetry(() =>
      boss.createQueue(name, {
        name,
        policy: 'standard',
        deadLetter: dlq,
        retryLimit: DEFAULT_JOB_RETRY.retryLimit,
        retryDelay: DEFAULT_JOB_RETRY.retryDelaySeconds,
        retryBackoff: DEFAULT_JOB_RETRY.retryBackoff,
        expireInSeconds: DEFAULT_JOB_RETRY.expireInMinutes * 60,
      }),
    );
  }
}
