import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import {
  UserRole,
  templateParamSchema,
  updateSettingsSchema,
  updateTemplateSchema,
  type EmailTemplateView,
  type EmailType,
  type SettingsView,
  type UpdateSettingsDto,
  type UpdateTemplateDto,
} from '@app/types';
import { CurrentUser, Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('settings')
  get(): Promise<SettingsView> {
    return this.settings.get();
  }

  @Roles(UserRole.ADMIN)
  @Patch('settings')
  update(
    @Body(zBody(updateSettingsSchema)) dto: UpdateSettingsDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SettingsView> {
    return this.settings.update(dto, actorId);
  }

  @Get('templates')
  listTemplates(): Promise<EmailTemplateView[]> {
    return this.settings.listTemplates();
  }

  @Roles(UserRole.ADMIN)
  @Put('templates/:type')
  updateTemplate(
    @Param(zBody(templateParamSchema)) params: { type: EmailType },
    @Body(zBody(updateTemplateSchema)) dto: UpdateTemplateDto,
    @CurrentUser('id') actorId: string,
  ): Promise<EmailTemplateView> {
    return this.settings.updateTemplate(params.type, dto, actorId);
  }
}
