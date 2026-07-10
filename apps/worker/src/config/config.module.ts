import { Global, Module } from '@nestjs/common';
import { WORKER_CONFIG, loadWorkerConfig } from './worker-config';

@Global()
@Module({
  providers: [{ provide: WORKER_CONFIG, useFactory: () => loadWorkerConfig() }],
  exports: [WORKER_CONFIG],
})
export class WorkerConfigModule {}
