import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import {
  PaymentDueStatus,
  type DueCell,
  type DuesBoardQuery,
  type DuesBoardResponse,
  type DuesBoardRow,
  type StudentDetailView,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/app-exception';
import { toDueDetailView, toEmailLogView, toReplyView } from '../common/mappers';

function emptyCounts(): Record<PaymentDueStatus, number> {
  return { UPCOMING: 0, REMINDED: 0, OVERDUE: 0, UNDER_REVIEW: 0, PAID: 0 };
}

@Injectable()
export class DuesReadService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveYearId(academicYearId?: string): Promise<string | null> {
    if (academicYearId) return academicYearId;
    const active = await this.prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return active?.id ?? null;
  }

  async getBoard(query: DuesBoardQuery): Promise<DuesBoardResponse> {
    const yearId = await this.resolveYearId(query.academicYearId);
    if (!yearId) {
      return { rows: [], installmentColumns: [], counts: emptyCounts(), totalDues: 0 };
    }

    const where: Prisma.StudentWhereInput = {
      academicYearId: yearId,
      isActive: true,
      schoolClassId: query.schoolClassId,
      ...(query.section ? { schoolClass: { section: query.section } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { regId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const students = await this.prisma.student.findMany({
      where,
      include: {
        schoolClass: { select: { name: true, section: true } },
        paymentDues: {
          include: { installment: { select: { installmentNumber: true } } },
          orderBy: { installment: { installmentNumber: 'asc' } },
        },
      },
      orderBy: [{ schoolClass: { name: 'asc' } }, { name: 'asc' }],
    });

    const allDueIds = students.flatMap((s) => s.paymentDues.map((d) => d.id));
    const pending = allDueIds.length
      ? await this.prisma.incomingReply.findMany({
          where: { paymentDueId: { in: allDueIds }, classification: 'UNREVIEWED' },
          select: { paymentDueId: true },
        })
      : [];
    const pendingSet = new Set(pending.map((p) => p.paymentDueId));

    const counts = emptyCounts();
    let maxInstallment = 0;
    for (const s of students) {
      for (const d of s.paymentDues) {
        counts[d.status]++;
        maxInstallment = Math.max(maxInstallment, d.installment.installmentNumber);
      }
    }

    const rows: DuesBoardRow[] = [];
    for (const s of students) {
      const matching = s.paymentDues.filter(
        (d) =>
          (!query.status || d.status === query.status) &&
          (!query.installmentNumber ||
            d.installment.installmentNumber === query.installmentNumber),
      );
      if ((query.status || query.installmentNumber) && matching.length === 0) continue;

      const cells: DueCell[] = s.paymentDues.map((d) => ({
        dueId: d.id,
        installmentNumber: d.installment.installmentNumber,
        amount: Number(d.amount),
        status: d.status,
        dueDate: d.dueDate.toISOString(),
        paidAmount: d.paidAmount === null ? null : Number(d.paidAmount),
        paidAt: d.paidAt ? d.paidAt.toISOString() : null,
        hasPendingReply: pendingSet.has(d.id),
      }));

      rows.push({
        studentId: s.id,
        studentName: s.name,
        regId: s.regId,
        className: s.schoolClass.name,
        section: s.schoolClass.section,
        parentEmail: s.parentEmail,
        cells,
      });
    }

    return {
      rows,
      installmentColumns: Array.from({ length: maxInstallment }, (_, i) => i + 1),
      counts,
      totalDues: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }

  async getStudentDetail(studentId: string): Promise<StudentDetailView> {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        schoolClass: {
          select: { name: true, section: true, feeStructure: { select: { totalAmount: true } } },
        },
        academicYear: { select: { label: true } },
        paymentDues: {
          include: {
            installment: { select: { installmentNumber: true } },
            markedPaidBy: { select: { name: true } },
          },
          orderBy: { installment: { installmentNumber: 'asc' } },
        },
        emailLogs: { orderBy: { createdAt: 'desc' } },
        incomingReplies: {
          orderBy: { receivedAt: 'desc' },
          include: {
            reviewedBy: { select: { name: true } },
            paymentDue: { include: { installment: { select: { installmentNumber: true } } } },
          },
        },
      },
    });
    if (!s) throw new NotFoundError('Student not found.');

    let paidAmount = 0;
    let outstandingAmount = 0;
    for (const d of s.paymentDues) {
      if (d.status === PaymentDueStatus.PAID) {
        paidAmount += Number(d.paidAmount ?? d.amount);
      } else {
        outstandingAmount += Number(d.amount);
      }
    }

    return {
      student: {
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
      },
      academicYearLabel: s.academicYear.label,
      totalAmount: s.schoolClass.feeStructure ? Number(s.schoolClass.feeStructure.totalAmount) : null,
      paidAmount,
      outstandingAmount,
      dues: s.paymentDues.map((d) => toDueDetailView(d)),
      emails: s.emailLogs.map((l) => toEmailLogView(l, s.name)),
      replies: s.incomingReplies.map((r) =>
        toReplyView({
          ...r,
          student: { id: s.id, name: s.name, regId: s.regId, schoolClass: { name: s.schoolClass.name } },
        }),
      ),
    };
  }
}
