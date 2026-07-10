import { z } from 'zod';
import { positiveAmountSchema } from './common';
import { amountsSumTo } from '../money';

export const installmentInputSchema = z.object({
  installmentNumber: z.number().int().min(1).max(12),
  amount: positiveAmountSchema,
  dueDate: z.coerce.date(),
});
export type InstallmentInput = z.infer<typeof installmentInputSchema>;

const installmentsRefinement = (
  data: { totalAmount: number; installments: InstallmentInput[] },
  ctx: z.RefinementCtx,
) => {
  const { totalAmount, installments } = data;
  // sequential 1..n
  const numbers = installments.map((i) => i.installmentNumber).sort((a, b) => a - b);
  const expected = Array.from({ length: installments.length }, (_, i) => i + 1);
  if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installments'],
      message: 'Installment numbers must be sequential starting at 1 with no gaps or duplicates',
    });
  }
  // amounts sum to total (paise-precise)
  if (!amountsSumTo(totalAmount, installments.map((i) => i.amount))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installments'],
      message: 'Installment amounts must sum exactly to the total amount',
    });
  }
};

export const upsertFeeStructureSchema = z
  .object({
    schoolClassId: z.string().min(1),
    totalAmount: positiveAmountSchema,
    installments: z.array(installmentInputSchema).min(1).max(12),
  })
  .superRefine(installmentsRefinement);
export type UpsertFeeStructureDto = z.infer<typeof upsertFeeStructureSchema>;

export interface InstallmentView {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
}

export interface FeeStructureView {
  id: string;
  schoolClassId: string;
  className: string;
  academicYearId: string;
  totalAmount: number;
  installments: InstallmentView[];
}
