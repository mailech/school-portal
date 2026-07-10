import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type PgBoss from 'pg-boss';
import {
  DEFAULT_JOB_RETRY,
  type EnqueueOptions,
  type JobPayloads,
  type QueuePort,
} from '@app/core';
import type { JobName } from '@app/types';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { createBoss, ensureQueues } from './pgboss.setup';

/**
 * pg-boss-backed producer. The API only enqueues; the worker consumes. Kept
 * behind QueuePort so a Redis/BullMQ implementation could replace it later.
 */
@Injectable()
export class QueueService implements QueuePort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Queue');
  private boss?: PgBoss;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.boss = createBoss(this.config.databaseUrl, this.config.queue.schema);
    this.boss.on('error', (err) => this.logger.error('pg-boss error', err));
    await this.boss.start();
    await ensureQueues(this.boss);
    this.logger.log('Queue producer ready (pg-boss)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop({ graceful: true });
  }

  async enqueue<K extends JobName>(
    name: K,
    data: JobPayloads[K],
    opts?: EnqueueOptions,
  ): Promise<string | null> {
    if (!this.boss) throw new Error('Queue not initialized');
    // pg-boss asserts on undefined option values — only include defined keys.
    const sendOpts: PgBoss.SendOptions = {
      retryLimit: opts?.retryLimit ?? DEFAULT_JOB_RETRY.retryLimit,
      retryDelay: opts?.retryDelaySeconds ?? DEFAULT_JOB_RETRY.retryDelaySeconds,
      retryBackoff: opts?.retryBackoff ?? DEFAULT_JOB_RETRY.retryBackoff,
    };
    if (opts?.singletonKey) sendOpts.singletonKey = opts.singletonKey;
    if (opts?.singletonSeconds != null) sendOpts.singletonSeconds = opts.singletonSeconds;
    if (opts?.startAfter != null) sendOpts.startAfter = opts.startAfter;
    if (opts?.priority != null) sendOpts.priority = opts.priority;
    return this.boss.send(name, data as object, sendOpts);
  }

  async schedule<K extends JobName>(
    name: K,
    cron: string,
    data: JobPayloads[K],
    timezone: string,
  ): Promise<void> {
    if (!this.boss) throw new Error('Queue not initialized');
    await this.boss.schedule(name, cron, data as object, { tz: timezone });
  }
}
