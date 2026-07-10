import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  confirmPaymentSchema,
  rejectReplySchema,
  replyListQuerySchema,
  type ConfirmPaymentDto,
  type DueActionResult,
  type RejectReplyDto,
  type ReplyListQuery,
  type ReplyView,
} from '@app/types';
import { CurrentUser } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { RepliesService } from './replies.service';

@Controller('replies')
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  @Get()
  list(@Query(zBody(replyListQuerySchema)) query: ReplyListQuery): Promise<ReplyView[]> {
    return this.replies.list(query);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body(zBody(confirmPaymentSchema)) dto: ConfirmPaymentDto,
    @CurrentUser('id') actorId: string,
  ): Promise<DueActionResult> {
    return this.replies.confirm(id, dto, actorId);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body(zBody(rejectReplySchema)) dto: RejectReplyDto,
    @CurrentUser('id') actorId: string,
  ): Promise<DueActionResult> {
    return this.replies.reject(id, dto, actorId);
  }
}
