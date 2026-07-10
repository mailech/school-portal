import { z } from 'zod';

export const createAcademicYearSchema = z.object({
  label: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .regex(/^\d{4}[-–]\d{2,4}$/, 'Use a label like "2025-26"'),
  timezone: z.string().trim().min(1).default('Asia/Kolkata'),
  isActive: z.boolean().default(false),
});
export type CreateAcademicYearDto = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = z.object({
  label: z.string().trim().min(4).max(20).optional(),
  timezone: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAcademicYearDto = z.infer<typeof updateAcademicYearSchema>;

export const createClassSchema = z.object({
  name: z.string().trim().min(1).max(60),
  section: z.string().trim().max(20).optional().nullable(),
  academicYearId: z.string().min(1),
});
export type CreateClassDto = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  section: z.string().trim().max(20).optional().nullable(),
});
export type UpdateClassDto = z.infer<typeof updateClassSchema>;

export interface AcademicYearView {
  id: string;
  label: string;
  isActive: boolean;
  timezone: string;
  classCount: number;
  studentCount: number;
}

export interface SchoolClassView {
  id: string;
  name: string;
  section: string | null;
  academicYearId: string;
  academicYearLabel: string;
  studentCount: number;
  hasFeeStructure: boolean;
  totalAmount: number | null;
}
