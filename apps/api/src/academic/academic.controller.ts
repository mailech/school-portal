import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  UserRole,
  createAcademicYearSchema,
  createClassSchema,
  updateAcademicYearSchema,
  updateClassSchema,
  type AcademicYearView,
  type CreateAcademicYearDto,
  type CreateClassDto,
  type SchoolClassView,
  type UpdateAcademicYearDto,
  type UpdateClassDto,
} from '@app/types';
import { CurrentUser, Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { AcademicService } from './academic.service';

@Controller()
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  // Reads: any authenticated staff member.
  @Get('academic-years')
  listYears(): Promise<AcademicYearView[]> {
    return this.academic.listYears();
  }

  @Get('classes')
  listClasses(@Query('academicYearId') academicYearId?: string): Promise<SchoolClassView[]> {
    return this.academic.listClasses(academicYearId);
  }

  // Mutations: ADMIN only.
  @Roles(UserRole.ADMIN)
  @Post('academic-years')
  createYear(
    @Body(zBody(createAcademicYearSchema)) dto: CreateAcademicYearDto,
    @CurrentUser('id') actorId: string,
  ): Promise<AcademicYearView> {
    return this.academic.createYear(dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('academic-years/:id')
  updateYear(
    @Param('id') id: string,
    @Body(zBody(updateAcademicYearSchema)) dto: UpdateAcademicYearDto,
    @CurrentUser('id') actorId: string,
  ): Promise<AcademicYearView> {
    return this.academic.updateYear(id, dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Post('classes')
  createClass(
    @Body(zBody(createClassSchema)) dto: CreateClassDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolClassView> {
    return this.academic.createClass(dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('classes/:id')
  updateClass(
    @Param('id') id: string,
    @Body(zBody(updateClassSchema)) dto: UpdateClassDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolClassView> {
    return this.academic.updateClass(id, dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Delete('classes/:id')
  @HttpCode(200)
  async deleteClass(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<{ ok: true }> {
    await this.academic.deleteClass(id, actorId);
    return { ok: true };
  }
}
