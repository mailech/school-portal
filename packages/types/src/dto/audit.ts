import { z } from 'zod';
import { paginationSchema } from './common';

export const auditQuerySchema = paginationSchema.extend({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntryView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}
