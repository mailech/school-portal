import { z } from 'zod';
import { emailSchema, mobileSchema, paginationSchema } from './common';

export const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  regId: z.string().trim().min(1).max(40),
  schoolClassId: z.string().min(1),
  parentName: z.string().trim().min(1).max(120),
  parentMobile: mobileSchema,
  parentEmail: emailSchema,
  isActive: z.boolean().default(true),
});
export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  regId: z.string().trim().min(1).max(40).optional(),
  schoolClassId: z.string().min(1).optional(),
  parentName: z.string().trim().min(1).max(120).optional(),
  parentMobile: mobileSchema.optional(),
  parentEmail: emailSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;

export const studentListQuerySchema = paginationSchema.extend({
  schoolClassId: z.string().optional(),
  academicYearId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

export interface StudentView {
  id: string;
  name: string;
  regId: string;
  schoolClassId: string;
  className: string;
  section: string | null;
  parentName: string;
  parentMobile: string;
  parentEmail: string;
  isActive: boolean;
}

// --- CSV / bulk import -----------------------------------------------------
// Import is scoped to one academic year; class is resolved by name (+ optional
// section) so office staff can paste a familiar roster.
export const importStudentRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  regId: z.string().trim().min(1).max(40),
  className: z.string().trim().min(1).max(60),
  section: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  parentName: z.string().trim().min(1).max(120),
  parentMobile: mobileSchema,
  parentEmail: emailSchema,
});
export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;

export const importStudentsSchema = z.object({
  academicYearId: z.string().min(1),
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  commit: z.boolean().default(false),
});
export type ImportStudentsDto = z.infer<typeof importStudentsSchema>;

export interface ImportRowError {
  rowNumber: number;
  regId?: string;
  errors: string[];
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  created: number;
  updated: number;
  committed: boolean;
  errors: ImportRowError[];
}
