import { Injectable } from '@nestjs/common';
import { Prisma, type Student } from '@app/db';
import {
  importStudentRowSchema,
  type CreateStudentDto,
  type ImportResult,
  type ImportRowError,
  type ImportStudentsDto,
  type Paginated,
  type StudentListQuery,
  type StudentView,
  type UpdateStudentDto,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DuesSyncService } from '../dues/dues-sync.service';
import { ConflictError, NotFoundError } from '../common/app-exception';

function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

type StudentWithClass = Student & {
  schoolClass: { name: string; section: string | null };
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly duesSync: DuesSyncService,
  ) {}

  private toView(s: StudentWithClass): StudentView {
    return {
      id: s.id,
      name: s.name,
      regId: s.regId,
      schoolClassId: s.schoolClassId,
      className: s.schoolClass.name,
      section: s.schoolClass.section,
      parentName: s.parentName,
      parentMobile: s.parentMobile,
      parentEmail: s.parentEmail,
      isActive: s.isActive,
    };
  }

  async list(query: StudentListQuery): Promise<Paginated<StudentView>> {
    const where: Prisma.StudentWhereInput = {
      schoolClassId: query.schoolClassId,
      academicYearId: query.academicYearId,
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { regId: { contains: query.search, mode: 'insensitive' } },
              { parentEmail: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: { schoolClass: { select: { name: true, section: true } } },
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);
    return {
      items: items.map((s) => this.toView(s)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<StudentView> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { schoolClass: { select: { name: true, section: true } } },
    });
    if (!s) throw new NotFoundError('Student not found.');
    return this.toView(s);
  }

  async create(dto: CreateStudentDto, actorId: string): Promise<StudentView> {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id: dto.schoolClassId } });
    if (!cls) throw new NotFoundError('Class not found.');
    const dup = await this.prisma.student.findUnique({ where: { regId: dto.regId } });
    if (dup) throw new ConflictError('A student with this registration ID already exists.');

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          name: dto.name,
          regId: dto.regId,
          schoolClassId: dto.schoolClassId,
          academicYearId: cls.academicYearId,
          parentName: dto.parentName,
          parentMobile: normalizeMobile(dto.parentMobile),
          parentEmail: dto.parentEmail,
          isActive: dto.isActive,
        },
      });
      await this.duesSync.syncStudent(created.id, tx);
      await this.audit.record(
        {
          userId: actorId,
          action: 'STUDENT_CREATED',
          entityType: 'Student',
          entityId: created.id,
          metadata: { regId: created.regId },
        },
        tx,
      );
      return created;
    });
    return this.get(student.id);
  }

  async update(id: string, dto: UpdateStudentDto, actorId: string): Promise<StudentView> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Student not found.');

    let academicYearId: string | undefined;
    if (dto.schoolClassId && dto.schoolClassId !== existing.schoolClassId) {
      const cls = await this.prisma.schoolClass.findUnique({ where: { id: dto.schoolClassId } });
      if (!cls) throw new NotFoundError('Class not found.');
      academicYearId = cls.academicYearId;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          name: dto.name,
          regId: dto.regId,
          schoolClassId: dto.schoolClassId,
          academicYearId,
          parentName: dto.parentName,
          parentMobile: dto.parentMobile ? normalizeMobile(dto.parentMobile) : undefined,
          parentEmail: dto.parentEmail,
          isActive: dto.isActive,
        },
      });
      if (dto.schoolClassId && dto.schoolClassId !== existing.schoolClassId) {
        await this.duesSync.resyncStudentClass(id, tx);
      } else if (dto.isActive === true && !existing.isActive) {
        await this.duesSync.syncStudent(id, tx);
      }
      await this.audit.record(
        {
          userId: actorId,
          action: 'STUDENT_UPDATED',
          entityType: 'Student',
          entityId: id,
          metadata: { ...dto },
        },
        tx,
      );
    });
    return this.get(id);
  }

  // --- Bulk import ----------------------------------------------------------
  async importStudents(dto: ImportStudentsDto, actorId: string): Promise<ImportResult> {
    const year = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!year) throw new NotFoundError('Academic year not found.');

    const classes = await this.prisma.schoolClass.findMany({
      where: { academicYearId: dto.academicYearId },
    });
    const classKey = (name: string, section: string | null) =>
      `${name.trim().toLowerCase()}||${(section ?? '').trim().toLowerCase()}`;
    const classMap = new Map(classes.map((c) => [classKey(c.name, c.section), c.id]));

    const errors: ImportRowError[] = [];
    const valid: Array<{ rowNumber: number; classId: string; data: Record<string, unknown> }> = [];
    const seenRegIds = new Set<string>();

    dto.rows.forEach((raw, index) => {
      const rowNumber = index + 1;
      const parsed = importStudentRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({
          rowNumber,
          regId: typeof raw.regId === 'string' ? raw.regId : undefined,
          errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
        });
        return;
      }
      const data = parsed.data;
      if (seenRegIds.has(data.regId)) {
        errors.push({ rowNumber, regId: data.regId, errors: ['Duplicate registration ID within the file'] });
        return;
      }
      seenRegIds.add(data.regId);
      const classId = classMap.get(classKey(data.className, data.section));
      if (!classId) {
        errors.push({
          rowNumber,
          regId: data.regId,
          errors: [
            `Class "${data.className}${data.section ? ' ' + data.section : ''}" not found in ${year.label}`,
          ],
        });
        return;
      }
      valid.push({ rowNumber, classId, data });
    });

    // Determine create vs update.
    const validRegIds = valid.map((v) => v.data.regId as string);
    const existing = await this.prisma.student.findMany({
      where: { regId: { in: validRegIds } },
      select: { regId: true },
    });
    const existingSet = new Set(existing.map((e) => e.regId));
    const toCreate = valid.filter((v) => !existingSet.has(v.data.regId as string));
    const toUpdate = valid.filter((v) => existingSet.has(v.data.regId as string));

    let created = 0;
    let updated = 0;

    if (dto.commit && valid.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const v of valid) {
            const d = v.data as {
              name: string;
              regId: string;
              parentName: string;
              parentMobile: string;
              parentEmail: string;
            };
            const student = await tx.student.upsert({
              where: { regId: d.regId },
              create: {
                name: d.name,
                regId: d.regId,
                schoolClassId: v.classId,
                academicYearId: dto.academicYearId,
                parentName: d.parentName,
                parentMobile: normalizeMobile(d.parentMobile),
                parentEmail: d.parentEmail,
              },
              update: {
                name: d.name,
                schoolClassId: v.classId,
                academicYearId: dto.academicYearId,
                parentName: d.parentName,
                parentMobile: normalizeMobile(d.parentMobile),
                parentEmail: d.parentEmail,
                isActive: true,
              },
            });
            await this.duesSync.resyncStudentClass(student.id, tx);
          }
          await this.audit.record(
            {
              userId: actorId,
              action: 'STUDENTS_IMPORTED',
              entityType: 'AcademicYear',
              entityId: dto.academicYearId,
              metadata: { created: toCreate.length, updated: toUpdate.length },
            },
            tx,
          );
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
      created = toCreate.length;
      updated = toUpdate.length;
    }

    return {
      totalRows: dto.rows.length,
      validRows: valid.length,
      invalidRows: errors.length,
      created,
      updated,
      committed: dto.commit && valid.length > 0,
      errors,
    };
  }
}
