import { z } from 'zod';
import { emailSchema } from './common';
import { UserRole } from '../enums';

/** Only staff roles can be created by an ADMIN in Phase 1. */
export const staffRoleSchema = z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT]);

export const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  role: staffRoleSchema,
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(200)
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/\d/, 'Must include a number'),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: staffRoleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

export const resetStaffPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(10)
    .max(200)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
});
export type ResetStaffPasswordDto = z.infer<typeof resetStaffPasswordSchema>;

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
