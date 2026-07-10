import { PaymentDueStatus, ReplyMatchMethod } from '@app/types';
import { matchReply, normalizeEmail, type MatchContext, type MatchCandidateDue } from './matching';
import type { InboundEmail } from '../ports/email.port';

const S = PaymentDueStatus;

function email(partial: Partial<InboundEmail>): InboundEmail {
  return {
    messageId: '<incoming@mail>',
    references: [],
    from: 'parent@example.com',
    subject: 'Re: Fees',
    text: 'We paid',
    receivedAt: new Date('2026-07-07T10:00:00Z'),
    ...partial,
  };
}

function ctx(overrides: Partial<MatchContext>): MatchContext {
  return {
    resolveThread: () => null,
    resolveSender: () => [],
    ...overrides,
  };
}

describe('normalizeEmail', () => {
  it('extracts a bare lowercase address from a display-name header', () => {
    expect(normalizeEmail('Parent Name <Parent@Example.COM>')).toBe('parent@example.com');
    expect(normalizeEmail('  parent@example.com ')).toBe('parent@example.com');
  });
});

describe('matchReply', () => {
  it('matches by thread via In-Reply-To', () => {
    const result = matchReply(
      email({ inReplyTo: '<orig-123@school>' }),
      ctx({
        resolveThread: (id) =>
          id === '<orig-123@school>' ? { dueId: 'due-9', studentId: 'stu-9' } : null,
      }),
    );
    expect(result).toEqual({ method: ReplyMatchMethod.THREAD, dueId: 'due-9', studentId: 'stu-9' });
  });

  it('falls back to the most recent References entry for threading', () => {
    const result = matchReply(
      email({ references: ['<old@school>', '<recent@school>'] }),
      ctx({
        resolveThread: (id) =>
          id === '<recent@school>' ? { dueId: 'due-2', studentId: 'stu-2' } : null,
      }),
    );
    expect(result.method).toBe(ReplyMatchMethod.THREAD);
    if (result.method === ReplyMatchMethod.THREAD) expect(result.dueId).toBe('due-2');
  });

  it('matches by sender when exactly one student, choosing the most urgent due', () => {
    const dues: MatchCandidateDue[] = [
      { dueId: 'd-upcoming', studentId: 'stu-1', status: S.UPCOMING, dueDate: new Date('2026-09-01') },
      { dueId: 'd-overdue', studentId: 'stu-1', status: S.OVERDUE, dueDate: new Date('2026-05-01') },
    ];
    const result = matchReply(
      email({ from: 'Mom <mom@example.com>' }),
      ctx({ resolveSender: () => dues }),
    );
    expect(result).toEqual({ method: ReplyMatchMethod.SENDER, dueId: 'd-overdue', studentId: 'stu-1' });
  });

  it('is UNMATCHED when the sender has no active dues', () => {
    const result = matchReply(email({}), ctx({ resolveSender: () => [] }));
    expect(result.method).toBe(ReplyMatchMethod.UNMATCHED);
  });

  it('is UNMATCHED when the parent email spans multiple students (ambiguous)', () => {
    const dues: MatchCandidateDue[] = [
      { dueId: 'd1', studentId: 'stu-1', status: S.OVERDUE, dueDate: new Date('2026-05-01') },
      { dueId: 'd2', studentId: 'stu-2', status: S.OVERDUE, dueDate: new Date('2026-05-01') },
    ];
    const result = matchReply(email({}), ctx({ resolveSender: () => dues }));
    expect(result.method).toBe(ReplyMatchMethod.UNMATCHED);
  });

  it('prefers threading over sender when both are possible', () => {
    const result = matchReply(
      email({ inReplyTo: '<orig@school>', from: 'mom@example.com' }),
      ctx({
        resolveThread: () => ({ dueId: 'threaded', studentId: 'stu-t' }),
        resolveSender: () => [
          { dueId: 'sender', studentId: 'stu-s', status: S.OVERDUE, dueDate: new Date() },
        ],
      }),
    );
    expect(result.method).toBe(ReplyMatchMethod.THREAD);
  });
});
