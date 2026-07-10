import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  UserRole,
  upsertFeeStructureSchema,
  type FeeStructureView,
  type UpsertFeeStructureDto,
} from '@app/types';
import { CurrentUser, Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { NotFoundError } from '../common/app-exception';
import { FeesService } from './fees.service';

@Controller('fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get('class/:schoolClassId')
  async getForClass(@Param('schoolClassId') schoolClassId: string): Promise<FeeStructureView> {
    const view = await this.fees.getForClass(schoolClassId);
    if (!view) throw new NotFoundError('No fee structure set for this class yet.');
    return view;
  }

  @Roles(UserRole.ADMIN)
  @Put()
  upsert(
    @Body(zBody(upsertFeeStructureSchema)) dto: UpsertFeeStructureDto,
    @CurrentUser('id') actorId: string,
  ): Promise<FeeStructureView> {
    return this.fees.upsert(dto, actorId);
  }
}
