import PgBoss from 'pg-boss';
import { DEFAULT_JOB_RETRY, DLQ_SUFFIX, QUEUE_NAMES } from '@app/core';

export function pgConnectionString(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export function createBoss(
  databaseUrl: string,
  schema: string,
  maintenance: { archiveCompletedAfterSeconds: number; deleteAfterDays: number },
): PgBoss {
  return new PgBoss({
    connectionString: pgConnectionString(databaseUrl),
    schema,
    application_name: 'schoolportal-worker',
    // The worker owns queue maintenance.
    supervise: true,
    archiveCompletedAfterSeconds: maintenance.archiveCompletedAfterSeconds,
    deleteAfterDays: maintenance.deleteAfterDays,
  });
}

const ALL_QUEUES = [
  QUEUE_NAMES.DAILY_SWEEP,
  QUEUE_NAMES.OUTBOUND_EMAIL,
  QUEUE_NAMES.INBOUND_POLL,
  QUEUE_NAMES.PROCESS_INBOUND,
];

export function dlqName(name: string): string {
  return `${name}${DLQ_SUFFIX}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of ALL_QUEUES) {
    const dlq = dlqName(name);
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
