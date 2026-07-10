import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  duesBoardQuerySchema,
  manualBlastSchema,
  markPaidSchema,
  type DueActionResult,
  type DuesBoardQuery,
  type DuesBoardResponse,
  type ManualBlastDto,
  type ManualBlastPreview,
  type MarkPaidDto,
  type StudentDetailView,
} from '@app/types';
import { CurrentUser } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { DuesReadService } from './dues-read.service';
import { DuesActionsService } from './dues-actions.service';

@Controller('dues')
export class DuesController {
  constructor(
    private readonly read: DuesReadService,
    private readonly actions: DuesActionsService,
  ) {}

  @Get('board')
  board(@Query(zBody(duesBoardQuerySchema)) query: DuesBoardQuery): Promise<DuesBoardResponse> {
    return this.read.getBoard(query);
  }

  @Get('student/:id')
  studentDetail(@Param('id') id: string): Promise<StudentDetailView> {
    return this.read.getStudentDetail(id);
  }

  @Post('email-overdue')
  emailOverdue(
    @Body(zBody(manualBlastSchema)) dto: ManualBlastDto,
    @CurrentUser('id') actorId: string,
  ): Promise<ManualBlastPreview> {
    return this.actions.emailOverdue(dto, actorId);
  }

  @Post(':dueId/mark-paid')
  markPaid(
    @Param('dueId') dueId: string,
    @Body(zBody(markPaidSchema)) dto: MarkPaidDto,
    @CurrentUser('id') actorId: string,
  ): Promise<DueActionResult> {
    return this.actions.markPaid(dueId, dto, actorId);
  }
}
