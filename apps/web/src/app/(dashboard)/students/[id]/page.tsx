'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import { EmailType, formatInr, type EmailLogView, type StudentDetailView } from '@app/types';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { StatusStamp } from '@/components/status';
import { MarkPaidModal, type MarkPaidTarget } from '@/components/mark-paid-modal';

const emailTypeLabel: Record<string, string> = {
  [EmailType.PRE_DUE_REMINDER]: 'Reminder',
  [EmailType.OVERDUE_NOTICE]: 'Overdue notice',
  [EmailType.ESCALATION]: 'Escalation',
  [EmailType.PAYMENT_RECEIVED]: 'Payment received',
  [EmailType.MANUAL_BLAST]: 'Manual notice',
};

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [markTarget, setMarkTarget] = useState<MarkPaidTarget | null>(null);

  const detail = useQuery<StudentDetailView>({
    queryKey: ['student', id],
    queryFn: () => api.get<StudentDetailView>(`/dues/student/${id}`),
  });

  if (detail.isLoading) return <Spinner label="Loading student…" />;
  if (!detail.data) return <p className="text-ink-soft">Student not found.</p>;
  const d = detail.data;

  return (
    <>
      <Link href="/dues" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-4">
        <ArrowLeft size={15} /> Back to register
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="label mb-1">
            {d.student.className}
            {d.student.section ? ` ${d.student.section}` : ''} · {d.academicYearLabel}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{d.student.name}</h1>
          <p className="mono text-sm text-ink-soft mt-1">{d.student.regId}</p>
        </div>
        <div className="flex gap-6">
          <Metric label="Total" value={d.totalAmount != null ? formatInr(d.totalAmount) : '—'} />
          <Metric label="Paid" value={formatInr(d.paidAmount)} tone="var(--green-ink)" />
          <Metric label="Outstanding" value={formatInr(d.outstandingAmount)} tone="var(--margin)" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          {/* Installments */}
          <section className="card">
            <SectionTitle>Installments</SectionTitle>
            <div className="divide-y divide-rule">
              {d.dues.map((due) => (
                <div key={due.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="font-medium">Installment {due.installmentNumber}</p>
                    <p className="text-sm text-ink-soft">
                      Due {new Date(due.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })} ·{' '}
                      <span className="mono">{formatInr(due.amount)}</span>
                      {due.paidAt ? (
                        <>
                          {' '}
                          · paid {new Date(due.paidAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          {due.markedPaidByName ? ` by ${due.markedPaidByName}` : ''}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusStamp
                      status={due.status}
                      amount={due.status === 'OVERDUE' ? due.amount : undefined}
                    />
                    {due.status !== 'PAID' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setMarkTarget({
                            dueId: due.id,
                            studentName: d.student.name,
                            installmentNumber: due.installmentNumber,
                            amount: due.amount,
                          })
                        }
                      >
                        Mark paid
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Replies */}
          <section className="card">
            <SectionTitle icon={<MessageSquare size={15} />}>Parent replies</SectionTitle>
            {d.replies.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-soft">No replies from this parent yet.</p>
            ) : (
              <div className="divide-y divide-rule">
                {d.replies.map((r) => (
                  <div key={r.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-sm">{r.subject}</p>
                      <span className="label">
                        {r.classification === 'UNREVIEWED'
                          ? 'Awaiting review'
                          : r.classification === 'IS_PAYMENT'
                            ? 'Confirmed'
                            : 'Not a payment'}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft whitespace-pre-wrap">{r.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Contact + email history */}
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <SectionTitle bare>Parent contact</SectionTitle>
            <dl className="text-sm flex flex-col gap-2.5 mt-2">
              <Row k="Name" v={d.student.parentName} />
              <Row k="Email" v={<span className="mono">{d.student.parentEmail}</span>} />
              <Row k="Mobile" v={<span className="mono">{d.student.parentMobile}</span>} />
            </dl>
          </section>

          <section className="card">
            <SectionTitle icon={<Mail size={15} />}>Email history</SectionTitle>
            {d.emails.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-soft">No emails sent yet.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {d.emails.map((e: EmailLogView) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{emailTypeLabel[e.type] ?? e.type}</span>
                      <EmailStatusPill status={e.status} />
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {e.sentAt
                        ? new Date(e.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : new Date(e.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      {e.error ? ` · ${e.error}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <MarkPaidModal target={markTarget} onClose={() => setMarkTarget(null)} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mono text-lg font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  icon,
  bare,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${bare ? '' : 'px-5 py-3.5 border-b border-rule'}`}>
      {icon ? <span className="text-ink-soft">{icon}</span> : null}
      <h2 className="label" style={{ fontSize: 12 }}>
        {children}
      </h2>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function EmailStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    SENT: 'stamp-green',
    QUEUED: 'stamp-blue',
    FAILED: 'stamp-red',
  };
  return <span className={`stamp ${map[status] ?? 'stamp-gray'}`}>{status}</span>;
}
