import 'reflect-metadata';
import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  const logger = new Logger('Worker');
  logger.log('Worker started — consuming jobs and running the scheduled sweep.');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
