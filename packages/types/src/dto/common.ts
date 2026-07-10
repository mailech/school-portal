import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Amount validator for INR money: non-negative, max 2 decimal places. */
export const amountSchema = z
  .number({ invalid_type_error: 'Amount must be a number' })
  .nonnegative('Amount cannot be negative')
  .refine((n) => Number.isFinite(n), 'Amount must be finite')
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(0)), {
    message: 'Amount cannot have more than 2 decimal places',
  });

/** Positive amount (installments/fees must be > 0). */
export const positiveAmountSchema = amountSchema.refine((n) => n > 0, {
  message: 'Amount must be greater than zero',
});

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');

/** Indian mobile: 10 digits, optional +91/0 prefix. Spaces/dashes are stripped;
 *  stored normalized to 10 digits by the service layer. */
export const mobileSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/[\s()-]/g, '') : v),
  z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/, 'Invalid mobile number'),
);
