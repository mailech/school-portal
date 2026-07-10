import { Module } from '@nestjs/common';
import { DuesModule } from '../dues/dues.module';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';

@Module({
  imports: [DuesModule],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
