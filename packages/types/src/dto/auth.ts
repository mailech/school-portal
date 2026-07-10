import { z } from 'zod';
import { emailSchema } from './common';
import type { UserRole } from '../enums';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(200)
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/\d/, 'Must include a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  user: CurrentUser;
}
