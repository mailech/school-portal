import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type PgBoss from 'pg-boss';
import {
  DEFAULT_JOB_RETRY,
  type EnqueueOptions,
  type JobPayloads,
  type QueuePort,
} from '@app/core';
import type { JobName } from '@app/types';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';
import { createBoss, ensureQueues } from './pgboss.setup';

/** Owns the pg-boss instance for the worker: it both produces (sweep enqueues
 *  emails) and exposes the boss so the consumer can register work handlers. */
@Injectable()
export class QueueService implements QueuePort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Queue');
  private boss?: PgBoss;

  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {}

  async onModuleInit(): Promise<void> {
    this.boss = createBoss(this.config.databaseUrl, this.config.queue.schema, {
      archiveCompletedAfterSeconds: this.config.queue.archiveCompletedAfterSec,
      deleteAfterDays: this.config.queue.deleteAfterDays,
    });
    this.boss.on('error', (err) => this.logger.error('pg-boss error', err));
    await this.boss.start();
    await ensureQueues(this.boss);
    this.logger.log('Queue owner ready (pg-boss)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop({ graceful: true });
  }

  getBoss(): PgBoss {
    if (!this.boss) throw new Error('Queue not initialized');
    return this.boss;
  }

  async enqueue<K extends JobName>(
    name: K,
    data: JobPayloads[K],
    opts?: EnqueueOptions,
  ): Promise<string | null> {
    const sendOpts: PgBoss.SendOptions = {
      retryLimit: opts?.retryLimit ?? DEFAULT_JOB_RETRY.retryLimit,
      retryDelay: opts?.retryDelaySeconds ?? DEFAULT_JOB_RETRY.retryDelaySeconds,
      retryBackoff: opts?.retryBackoff ?? DEFAULT_JOB_RETRY.retryBackoff,
    };
    if (opts?.singletonKey) sendOpts.singletonKey = opts.singletonKey;
    if (opts?.singletonSeconds != null) sendOpts.singletonSeconds = opts.singletonSeconds;
    if (opts?.startAfter != null) sendOpts.startAfter = opts.startAfter;
    if (opts?.priority != null) sendOpts.priority = opts.priority;
    return this.getBoss().send(name, data as object, sendOpts);
  }

  async schedule<K extends JobName>(
    name: K,
    cron: string,
    data: JobPayloads[K],
    timezone: string,
  ): Promise<void> {
    await this.getBoss().schedule(name, cron, data as object, { tz: timezone });
  }
}
