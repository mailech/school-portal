import { Module } from '@nestjs/common';
import { DuesModule } from '../dues/dues.module';
import { RepliesController } from './replies.controller';
import { RepliesService } from './replies.service';

@Module({
  imports: [DuesModule],
  controllers: [RepliesController],
  providers: [RepliesService],
  exports: [RepliesService],
})
export class RepliesModule {}
