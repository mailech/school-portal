import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  UserRole,
  createStaffSchema,
  resetStaffPasswordSchema,
  updateStaffSchema,
  type CreateStaffDto,
  type ResetStaffPasswordDto,
  type UpdateStaffDto,
  type UserView,
} from '@app/types';
import { CurrentUser, Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<UserView[]> {
    return this.users.list();
  }

  @Post()
  create(
    @Body(zBody(createStaffSchema)) dto: CreateStaffDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserView> {
    return this.users.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zBody(updateStaffSchema)) dto: UpdateStaffDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserView> {
    return this.users.update(id, dto, actorId);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(
    @Param('id') id: string,
    @Body(zBody(resetStaffPasswordSchema)) dto: ResetStaffPasswordDto,
    @CurrentUser('id') actorId: string,
  ): Promise<{ ok: true }> {
    await this.users.resetPassword(id, dto, actorId);
    return { ok: true };
  }
}
