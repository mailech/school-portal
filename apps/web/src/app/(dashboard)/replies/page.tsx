'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Loader2, X } from 'lucide-react';
import { formatInr, type ReplyView } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { StatusStamp } from '@/components/status';
import { useToast } from '@/components/toast';

export default function RepliesPage() {
  const [pendingOnly, setPendingOnly] = useState(true);
  const replies = useQuery<ReplyView[]>({
    queryKey: ['replies', pendingOnly],
    queryFn: () => api.get<ReplyView[]>(`/replies${pendingOnly ? '?onlyPendingReview=true' : ''}`),
  });

  return (
    <>
      <PageHeader
        eyebrow="Parent replies"
        title="Reply queue"
        subtitle="When a parent replies to a reminder, the installment turns yellow and waits here for your confirmation."
        actions={
          <div className="flex rounded-lg border border-rule-strong overflow-hidden text-sm">
            <button
              className="px-3 py-2"
              style={{
                background: pendingOnly ? 'var(--seal)' : 'var(--sheet)',
                color: pendingOnly ? 'var(--btn-fg)' : 'var(--ink)',
              }}
              onClick={() => setPendingOnly(true)}
            >
              Needs review
            </button>
            <button
              className="px-3 py-2 border-l border-rule-strong"
              style={{
                background: !pendingOnly ? 'var(--seal)' : 'var(--sheet)',
                color: !pendingOnly ? 'var(--btn-fg)' : 'var(--ink)',
              }}
              onClick={() => setPendingOnly(false)}
            >
              All replies
            </button>
          </div>
        }
      />

      {replies.isLoading ? (
        <div className="card">
          <Spinner label="Loading replies…" />
        </div>
      ) : !replies.data || replies.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={pendingOnly ? 'Nothing waiting on you' : 'No replies yet'}
          message={
            pendingOnly
              ? 'Every parent reply has been reviewed. New replies will appear here automatically.'
              : 'Parent replies to reminders will show up here once they arrive.'
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {replies.data.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} />
          ))}
        </div>
      )}
    </>
  );
}

function ReplyCard({ reply }: { reply: ReplyView }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['replies'] });
    qc.invalidateQueries({ queryKey: ['board'] });
    qc.invalidateQueries({ queryKey: ['student'] });
  };

  const confirm = useMutation({
    mutationFn: () => api.post(`/replies/${reply.id}/confirm`, {}),
    onSuccess: () => {
      toast.show(`Payment confirmed for ${reply.student?.name ?? 'the student'}.`);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not confirm.'),
  });

  const reject = useMutation({
    mutationFn: () => api.post(`/replies/${reply.id}/reject`, {}),
    onSuccess: () => {
      toast.show('Marked as not a payment.');
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not update.'),
  });

  const pending = reply.classification === 'UNREVIEWED';
  const busy = confirm.isPending || reject.isPending;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {reply.student ? (
              <Link href={`/students/${reply.student.id}`} className="font-semibold hover:text-seal">
                {reply.student.name}
              </Link>
            ) : (
              <span className="font-semibold text-ink-soft">Unmatched reply</span>
            )}
            {reply.student ? (
              <span className="mono text-xs text-ink-soft">
                {reply.student.regId} · {reply.student.className}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-ink-soft mt-0.5">
            From <span className="mono">{reply.fromEmail}</span> ·{' '}
            {new Date(reply.receivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reply.due ? (
            <StatusStamp
              status={reply.due.status}
              amount={reply.due.status === 'OVERDUE' ? reply.due.amount : undefined}
            />
          ) : null}
          {!pending ? (
            <span className="label" style={{ color: reply.classification === 'IS_PAYMENT' ? 'var(--green-ink)' : 'var(--red-ink)' }}>
              {reply.classification === 'IS_PAYMENT' ? 'Confirmed' : 'Not a payment'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-rule bg-paper/40 p-3.5 text-sm whitespace-pre-wrap text-ink-soft mb-4">
        <p className="font-medium text-ink mb-1">{reply.subject}</p>
        {reply.bodyText.slice(0, 900)}
      </div>

      {error ? (
        <p className="text-xs mb-3" style={{ color: 'var(--red-ink)' }}>
          {error}
        </p>
      ) : null}

      {pending && reply.due ? (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => confirm.mutate()} disabled={busy}>
            {confirm.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
            Payment received{reply.due ? ` — ${formatInr(reply.due.amount)}` : ''}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => reject.mutate()} disabled={busy}>
            {reject.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
            Not a payment
          </button>
        </div>
      ) : pending && !reply.due ? (
        <p className="text-sm text-ink-soft">
          This reply couldn’t be matched to a due automatically. Review it and act on the student’s
          record.
        </p>
      ) : null}
    </div>
  );
}
