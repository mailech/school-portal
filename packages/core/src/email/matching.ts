import { PaymentDueStatus, ReplyMatchMethod } from '@app/types';
import type { InboundEmail } from '../ports/email.port';

export interface MatchCandidateDue {
  dueId: string;
  studentId: string;
  status: PaymentDueStatus;
  dueDate: Date;
}

export interface MatchContext {
  /** Resolve a stored Message-ID (from an EmailLog) to its due + student. */
  resolveThread(messageId: string): { dueId: string; studentId: string } | null;
  /** Non-PAID dues belonging to the sender's parent email (may span students). */
  resolveSender(fromEmail: string): MatchCandidateDue[];
}

export type MatchResult =
  | { method: typeof ReplyMatchMethod.THREAD; dueId: string; studentId: string }
  | { method: typeof ReplyMatchMethod.SENDER; dueId: string; studentId: string }
  | { method: typeof ReplyMatchMethod.UNMATCHED; studentId?: string };

/** Extracts a bare, normalized email address from a From header value. */
export function normalizeEmail(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  const raw = (angle ? angle[1] : from).trim().toLowerCase();
  return raw;
}

/** Priority for choosing among several dues of one student (most urgent first). */
const STATUS_PRIORITY: Record<PaymentDueStatus, number> = {
  OVERDUE: 0,
  UNDER_REVIEW: 1,
  REMINDED: 2,
  UPCOMING: 3,
  PAID: 4,
};

function pickBestDue(candidates: MatchCandidateDue[]): MatchCandidateDue {
  return [...candidates].sort((a, b) => {
    const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (p !== 0) return p;
    // tie-break: earliest due date (oldest debt) first
    return a.dueDate.getTime() - b.dueDate.getTime();
  })[0];
}

/**
 * Pure reply matcher.
 *   1. THREAD  — In-Reply-To / References resolve to a stored Message-ID.
 *   2. SENDER  — the parent email maps to exactly one student's active due(s).
 *   3. UNMATCHED — nothing confident (0 dues, or dues across multiple students).
 */
export function matchReply(inbound: InboundEmail, ctx: MatchContext): MatchResult {
  // 1) Threading: prefer In-Reply-To, then the most recent References entry.
  const threadIds = [inbound.inReplyTo, ...[...inbound.references].reverse()].filter(
    (v): v is string => !!v,
  );
  const seen = new Set<string>();
  for (const id of threadIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const hit = ctx.resolveThread(id);
    if (hit) {
      return { method: ReplyMatchMethod.THREAD, dueId: hit.dueId, studentId: hit.studentId };
    }
  }

  // 2) Sender fallback.
  const email = normalizeEmail(inbound.from);
  const candidates = ctx.resolveSender(email).filter((c) => c.status !== PaymentDueStatus.PAID);
  if (candidates.length === 0) {
    return { method: ReplyMatchMethod.UNMATCHED };
  }
  const students = new Set(candidates.map((c) => c.studentId));
  if (students.size === 1) {
    const best = pickBestDue(candidates);
    return { method: ReplyMatchMethod.SENDER, dueId: best.dueId, studentId: best.studentId };
  }

  // Ambiguous: same parent email, multiple students -> manual triage.
  return { method: ReplyMatchMethod.UNMATCHED };
}
