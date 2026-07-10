import { Injectable } from '@nestjs/common';
import type { FeeStructureView, UpsertFeeStructureDto } from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DuesSyncService } from '../dues/dues-sync.service';
import { ConflictError, NotFoundError } from '../common/app-exception';

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly duesSync: DuesSyncService,
  ) {}

  async getForClass(schoolClassId: string): Promise<FeeStructureView | null> {
    const fee = await this.prisma.feeStructure.findUnique({
      where: { schoolClassId },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        schoolClass: { select: { name: true, section: true } },
      },
    });
    if (!fee) return null;
    return {
      id: fee.id,
      schoolClassId: fee.schoolClassId,
      className: `${fee.schoolClass.name}${fee.schoolClass.section ? ' ' + fee.schoolClass.section : ''}`,
      academicYearId: fee.academicYearId,
      totalAmount: Number(fee.totalAmount),
      installments: fee.installments.map((i) => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        amount: Number(i.amount),
        dueDate: i.dueDate.toISOString(),
      })),
    };
  }

  async upsert(dto: UpsertFeeStructureDto, actorId: string): Promise<FeeStructureView> {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id: dto.schoolClassId } });
    if (!cls) throw new NotFoundError('Class not found.');

    await this.prisma.$transaction(
      async (tx) => {
        const fee = await tx.feeStructure.upsert({
          where: { schoolClassId: dto.schoolClassId },
          create: {
            schoolClassId: dto.schoolClassId,
            academicYearId: cls.academicYearId,
            totalAmount: dto.totalAmount,
          },
          update: { totalAmount: dto.totalAmount },
        });

        const newNumbers = new Set(dto.installments.map((i) => i.installmentNumber));
        const existing = await tx.installment.findMany({ where: { feeStructureId: fee.id } });

        // Remove installments no longer present — but never one with recorded payments.
        for (const ex of existing) {
          if (!newNumbers.has(ex.installmentNumber)) {
            const paid = await tx.paymentDue.count({
              where: { installmentId: ex.id, status: 'PAID' },
            });
            if (paid > 0) {
              throw new ConflictError(
                `Cannot remove installment ${ex.installmentNumber}: payments have already been recorded against it.`,
              );
            }
            await tx.installment.delete({ where: { id: ex.id } });
          }
        }

        for (const inst of dto.installments) {
          await tx.installment.upsert({
            where: {
              feeStructureId_installmentNumber: {
                feeStructureId: fee.id,
                installmentNumber: inst.installmentNumber,
              },
            },
            create: {
              feeStructureId: fee.id,
              installmentNumber: inst.installmentNumber,
              amount: inst.amount,
              dueDate: inst.dueDate,
            },
            update: { amount: inst.amount, dueDate: inst.dueDate },
          });
        }

        await this.duesSync.syncFeeStructure(fee.id, tx);

        await this.audit.record(
          {
            userId: actorId,
            action: 'FEE_STRUCTURE_UPSERTED',
            entityType: 'FeeStructure',
            entityId: fee.id,
            metadata: { schoolClassId: dto.schoolClassId, totalAmount: dto.totalAmount },
          },
          tx,
        );
      },
      { timeout: 30_000, maxWait: 8_000 },
    );

    const view = await this.getForClass(dto.schoolClassId);
    if (!view) throw new NotFoundError('Fee structure not found after save.');
    return view;
  }
}
