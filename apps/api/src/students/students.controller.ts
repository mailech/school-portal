import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  UserRole,
  createStudentSchema,
  importStudentsSchema,
  studentListQuerySchema,
  updateStudentSchema,
  type CreateStudentDto,
  type ImportResult,
  type ImportStudentsDto,
  type Paginated,
  type StudentListQuery,
  type StudentView,
  type UpdateStudentDto,
} from '@app/types';
import { CurrentUser, Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(
    @Query(zBody(studentListQuerySchema)) query: StudentListQuery,
  ): Promise<Paginated<StudentView>> {
    return this.students.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<StudentView> {
    return this.students.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body(zBody(createStudentSchema)) dto: CreateStudentDto,
    @CurrentUser('id') actorId: string,
  ): Promise<StudentView> {
    return this.students.create(dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zBody(updateStudentSchema)) dto: UpdateStudentDto,
    @CurrentUser('id') actorId: string,
  ): Promise<StudentView> {
    return this.students.update(id, dto, actorId);
  }

  @Roles(UserRole.ADMIN)
  @Post('import')
  importStudents(
    @Body(zBody(importStudentsSchema)) dto: ImportStudentsDto,
    @CurrentUser('id') actorId: string,
  ): Promise<ImportResult> {
    return this.students.importStudents(dto, actorId);
  }
}
