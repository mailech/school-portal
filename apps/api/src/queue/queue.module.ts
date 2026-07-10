import { Global, Module } from '@nestjs/common';
import { QUEUE_PORT } from '@app/core';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService, { provide: QUEUE_PORT, useExisting: QueueService }],
  exports: [QueueService, QUEUE_PORT],
})
export class QueueModule {}
