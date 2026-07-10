import { Module } from '@nestjs/common';
import { DuesController } from './dues.controller';
import { DuesSyncService } from './dues-sync.service';
import { DuesReadService } from './dues-read.service';
import { DuesActionsService } from './dues-actions.service';

@Module({
  controllers: [DuesController],
  providers: [DuesSyncService, DuesReadService, DuesActionsService],
  exports: [DuesSyncService, DuesActionsService, DuesReadService],
})
export class DuesModule {}
