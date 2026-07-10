import { Injectable } from '@nestjs/common';
import type {
  AcademicYearView,
  CreateAcademicYearDto,
  CreateClassDto,
  SchoolClassView,
  UpdateAcademicYearDto,
  UpdateClassDto,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictError, NotFoundError } from '../common/app-exception';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Academic years -------------------------------------------------------
  async listYears(): Promise<AcademicYearView[]> {
    const years = await this.prisma.academicYear.findMany({
      orderBy: [{ isActive: 'desc' }, { label: 'desc' }],
      include: { _count: { select: { classes: true, students: true } } },
    });
    return years.map((y) => ({
      id: y.id,
      label: y.label,
      isActive: y.isActive,
      timezone: y.timezone,
      classCount: y._count.classes,
      studentCount: y._count.students,
    }));
  }

  async createYear(dto: CreateAcademicYearDto, actorId: string): Promise<AcademicYearView> {
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.academicYear.updateMany({ data: { isActive: false } });
      }
      return tx.academicYear.create({
        data: { label: dto.label, timezone: dto.timezone, isActive: dto.isActive },
      });
    });
    await this.audit.record({
      userId: actorId,
      action: 'ACADEMIC_YEAR_CREATED',
      entityType: 'AcademicYear',
      entityId: created.id,
      metadata: { label: created.label },
    });
    return {
      id: created.id,
      label: created.label,
      isActive: created.isActive,
      timezone: created.timezone,
      classCount: 0,
      studentCount: 0,
    };
  }

  async updateYear(
    id: string,
    dto: UpdateAcademicYearDto,
    actorId: string,
  ): Promise<AcademicYearView> {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundError('Academic year not found.');

    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive === true) {
        await tx.academicYear.updateMany({ where: { id: { not: id } }, data: { isActive: false } });
      }
      await tx.academicYear.update({
        where: { id },
        data: { label: dto.label, timezone: dto.timezone, isActive: dto.isActive },
      });
    });
    await this.audit.record({
      userId: actorId,
      action: 'ACADEMIC_YEAR_UPDATED',
      entityType: 'AcademicYear',
      entityId: id,
      metadata: { ...dto },
    });
    const [refreshed] = await this.listYears().then((ys) => ys.filter((y) => y.id === id));
    return refreshed;
  }

  // --- Classes --------------------------------------------------------------
  async listClasses(academicYearId?: string): Promise<SchoolClassView[]> {
    const classes = await this.prisma.schoolClass.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
      include: {
        academicYear: { select: { label: true } },
        feeStructure: { select: { totalAmount: true } },
        _count: { select: { students: true } },
      },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      academicYearId: c.academicYearId,
      academicYearLabel: c.academicYear.label,
      studentCount: c._count.students,
      hasFeeStructure: c.feeStructure !== null,
      totalAmount: c.feeStructure ? Number(c.feeStructure.totalAmount) : null,
    }));
  }

  async createClass(dto: CreateClassDto, actorId: string): Promise<SchoolClassView> {
    const year = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!year) throw new NotFoundError('Academic year not found.');

    const existing = await this.prisma.schoolClass.findFirst({
      where: { academicYearId: dto.academicYearId, name: dto.name, section: dto.section ?? null },
    });
    if (existing) throw new ConflictError('A class with this name and section already exists.');

    const created = await this.prisma.schoolClass.create({
      data: {
        name: dto.name,
        section: dto.section ?? null,
        academicYearId: dto.academicYearId,
      },
    });
    await this.audit.record({
      userId: actorId,
      action: 'CLASS_CREATED',
      entityType: 'SchoolClass',
      entityId: created.id,
      metadata: { name: created.name, section: created.section },
    });
    return {
      id: created.id,
      name: created.name,
      section: created.section,
      academicYearId: created.academicYearId,
      academicYearLabel: year.label,
      studentCount: 0,
      hasFeeStructure: false,
      totalAmount: null,
    };
  }

  async updateClass(id: string, dto: UpdateClassDto, actorId: string): Promise<SchoolClassView> {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundError('Class not found.');
    await this.prisma.schoolClass.update({
      where: { id },
      data: { name: dto.name, section: dto.section === undefined ? undefined : dto.section },
    });
    await this.audit.record({
      userId: actorId,
      action: 'CLASS_UPDATED',
      entityType: 'SchoolClass',
      entityId: id,
      metadata: { ...dto },
    });
    const [view] = await this.listClasses(cls.academicYearId).then((cs) =>
      cs.filter((c) => c.id === id),
    );
    return view;
  }

  async deleteClass(id: string, actorId: string): Promise<void> {
    const cls = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!cls) throw new NotFoundError('Class not found.');
    if (cls._count.students > 0) {
      throw new ConflictError('Cannot delete a class that still has students.');
    }
    await this.prisma.schoolClass.delete({ where: { id } });
    await this.audit.record({
      userId: actorId,
      action: 'CLASS_DELETED',
      entityType: 'SchoolClass',
      entityId: id,
    });
  }
}
