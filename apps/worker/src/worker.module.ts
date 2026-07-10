import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkerConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.service';
import { SettingsModule } from './settings/settings.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { InboundModule } from './inbound/inbound.module';
import { SweepService } from './sweep/sweep.service';
import { WorkerRunner } from './runner/worker-runner.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WorkerConfigModule,
    PrismaModule,
    AuditModule,
    SettingsModule,
    QueueModule,
    EmailModule,
    InboundModule,
  ],
  providers: [SweepService, WorkerRunner],
})
export class WorkerModule {}
