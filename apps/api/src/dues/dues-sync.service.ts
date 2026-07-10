import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Keeps PaymentDue rows in sync with fee structures and students. Creating a fee
 * structure generates a due per (active student × installment); adding a student
 * generates their dues; changing a class re-generates them. PAID dues are never
 * mutated; other non-terminal dues track the installment's amount/dueDate.
 */
@Injectable()
export class DuesSyncService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  /** Generate/refresh dues for every active student in a fee structure's class. */
  async syncFeeStructure(feeStructureId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = this.db(tx);
    const fee = await db.feeStructure.findUnique({
      where: { id: feeStructureId },
      include: { installments: true },
    });
    if (!fee) return;

    const students = await db.student.findMany({
      where: { schoolClassId: fee.schoolClassId, isActive: true },
      select: { id: true },
    });
    if (students.length === 0) return;

    for (const inst of fee.installments) {
      await db.paymentDue.createMany({
        data: students.map((s) => ({
          studentId: s.id,
          installmentId: inst.id,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: 'UPCOMING' as const,
        })),
        skipDuplicates: true,
      });
      // Reflect amount/dueDate changes onto not-yet-paid dues.
      await db.paymentDue.updateMany({
        where: { installmentId: inst.id, status: { not: 'PAID' } },
        data: { amount: inst.amount, dueDate: inst.dueDate },
      });
    }
  }

  /** Generate/refresh dues for a single student from their class fee structure. */
  async syncStudent(studentId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = this.db(tx);
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        isActive: true,
        schoolClass: { select: { feeStructure: { include: { installments: true } } } },
      },
    });
    if (!student || !student.isActive) return;
    const fee = student.schoolClass.feeStructure;
    if (!fee) return;

    for (const inst of fee.installments) {
      await db.paymentDue.createMany({
        data: [
          {
            studentId,
            installmentId: inst.id,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: 'UPCOMING' as const,
          },
        ],
        skipDuplicates: true,
      });
      await db.paymentDue.updateMany({
        where: { studentId, installmentId: inst.id, status: { not: 'PAID' } },
        data: { amount: inst.amount, dueDate: inst.dueDate },
      });
    }
  }

  /**
   * When a student changes class, drop their non-terminal dues that belong to a
   * different fee structure (keeping PAID and UNDER_REVIEW for history), then
   * regenerate for the new class.
   */
  async resyncStudentClass(studentId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = this.db(tx);
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { schoolClass: { select: { feeStructure: { select: { id: true } } } } },
    });
    const keepFeeStructureId = student?.schoolClass.feeStructure?.id ?? null;

    await db.paymentDue.deleteMany({
      where: {
        studentId,
        status: { in: ['UPCOMING', 'REMINDED', 'OVERDUE'] },
        installment: keepFeeStructureId
          ? { feeStructureId: { not: keepFeeStructureId } }
          : undefined,
      },
    });
    await this.syncStudent(studentId, tx);
  }
}
