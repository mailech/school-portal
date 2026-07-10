'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mail, Table2 } from 'lucide-react';
import {
  PAYMENT_DUE_STATUS_ORDER,
  STATUS_META,
  type DueCell,
  type DuesBoardResponse,
  type PaymentDueStatus,
} from '@app/types';
import { api, qs } from '@/lib/api';
import { useAcademicYears, useClasses } from '@/lib/queries';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { StatusStamp, StatusLegend, StatusDot } from '@/components/status';
import { MarkPaidModal, type MarkPaidTarget } from '@/components/mark-paid-modal';
import { EmailOverdueModal } from '@/components/email-overdue-modal';

const toneDot: Record<string, string> = {
  neutral: 'dot-gray',
  info: 'dot-blue',
  danger: 'dot-red',
  warning: 'dot-amber',
  success: 'dot-green',
};

export default function DuesBoardPage() {
  const years = useAcademicYears();
  const activeYear = years.data?.find((y) => y.isActive) ?? years.data?.[0];
  const [yearId, setYearId] = useState<string>('');
  const effectiveYear = yearId || activeYear?.id;
  const classes = useClasses(effectiveYear);

  const [schoolClassId, setSchoolClassId] = useState('');
  const [status, setStatus] = useState<PaymentDueStatus | ''>('');
  const [installment, setInstallment] = useState('');
  const [search, setSearch] = useState('');

  const [markTarget, setMarkTarget] = useState<MarkPaidTarget | null>(null);
  const [blastOpen, setBlastOpen] = useState(false);

  const board = useQuery<DuesBoardResponse>({
    queryKey: ['board', effectiveYear, schoolClassId, status, installment, search],
    queryFn: () =>
      api.get<DuesBoardResponse>(
        '/dues/board' +
          qs({
            academicYearId: effectiveYear,
            schoolClassId: schoolClassId || undefined,
            status: status || undefined,
            installmentNumber: installment || undefined,
            search: search || undefined,
          }),
      ),
    enabled: !!effectiveYear,
    placeholderData: (prev) => prev,
  });

  const data = board.data;
  const columns = data?.installmentColumns ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Accounts office"
        title="Dues register"
        subtitle="Every student's installments at a glance. Red needs chasing; yellow is a reply waiting on you."
        actions={
          <button className="btn btn-primary" onClick={() => setBlastOpen(true)}>
            <Mail size={15} /> Email overdue
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <Field label="Year">
          <select className="field" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">{activeYear ? `${activeYear.label} (active)` : 'Active year'}</option>
            {years.data?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Class">
          <select
            className="field"
            value={schoolClassId}
            onChange={(e) => setSchoolClassId(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` ${c.section}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Installment">
          <select className="field" value={installment} onChange={(e) => setInstallment(e.target.value)}>
            <option value="">All</option>
            {columns.map((n) => (
              <option key={n} value={n}>
                #{n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className="field"
            placeholder="Name or reg ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>

      {/* Tally band — clickable status filters */}
      {data ? (
        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {PAYMENT_DUE_STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(active ? '' : s)}
                  className="flex items-baseline gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
                  style={{ background: active ? 'var(--seal-soft)' : 'transparent' }}
                >
                  <span className={`dot ${toneDot[meta.tone]}`} />
                  <span className="mono text-xl font-semibold">{data.counts[s]}</span>
                  <span className="label" style={{ letterSpacing: '.06em' }}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
            <span className="ml-auto text-xs text-ink-soft mono">{data.totalDues} dues</span>
          </div>
        </div>
      ) : null}

      {/* Register */}
      {board.isLoading || years.isLoading ? (
        <div className="card">
          <Spinner label="Opening the register…" />
        </div>
      ) : !effectiveYear ? (
        <EmptyState
          icon={Table2}
          title="No academic year yet"
          message="An administrator needs to create an academic year, classes, and fee structures before dues appear."
        />
      ) : data && data.rows.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="Nothing to show here"
          message="No students match these filters. Try clearing the class or status filter."
        />
      ) : data ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr>
                  <th className="reg-margin-head" aria-hidden />
                  <ThHead>Reg ID</ThHead>
                  <ThHead>Student</ThHead>
                  <ThHead className="hidden md:table-cell">Class</ThHead>
                  {columns.map((n) => (
                    <ThHead key={n} center>
                      Installment {n}
                    </ThHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const byNum = new Map<number, DueCell>();
                  row.cells.forEach((c) => byNum.set(c.installmentNumber, c));
                  return (
                    <tr key={row.studentId} className="group">
                      <td className="reg-margin" />
                      <td className="reg-cell mono text-ink-soft text-[13px]">{row.regId}</td>
                      <td className="reg-cell">
                        <Link
                          href={`/students/${row.studentId}`}
                          className="font-semibold hover:text-seal"
                        >
                          {row.studentName}
                        </Link>
                      </td>
                      <td className="reg-cell hidden md:table-cell text-ink-soft text-sm">
                        {row.className}
                        {row.section ? ` ${row.section}` : ''}
                      </td>
                      {columns.map((n) => {
                        const cell = byNum.get(n);
                        if (!cell)
                          return (
                            <td key={n} className="reg-cell text-center text-ink-faint">
                              —
                            </td>
                          );
                        const canPay = cell.status !== 'PAID';
                        const showAmount =
                          cell.status === 'OVERDUE' || cell.status === 'UNDER_REVIEW';
                        return (
                          <td key={n} className="reg-cell text-center">
                            {canPay ? (
                              <button
                                onClick={() =>
                                  setMarkTarget({
                                    dueId: cell.dueId,
                                    studentName: row.studentName,
                                    installmentNumber: cell.installmentNumber,
                                    amount: cell.amount,
                                  })
                                }
                                title="Click to record a payment"
                                className="cursor-pointer"
                              >
                                <StatusStamp
                                  status={cell.status}
                                  amount={showAmount ? cell.amount : undefined}
                                />
                              </button>
                            ) : (
                              <StatusStamp status={cell.status} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-rule px-4 py-3">
            <StatusLegend />
          </div>
        </div>
      ) : null}

      <MarkPaidModal target={markTarget} onClose={() => setMarkTarget(null)} />
      <EmailOverdueModal
        open={blastOpen}
        onClose={() => setBlastOpen(false)}
        scope={{
          academicYearId: effectiveYear,
          schoolClassId: schoolClassId || undefined,
          installmentNumber: installment ? Number(installment) : undefined,
        }}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function ThHead({
  children,
  center,
  className = '',
}: {
  children: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`label font-semibold text-left px-3.5 py-3 border-b border-rule-strong sticky top-0 ${
        center ? 'text-center' : ''
      } ${className}`}
      style={{ background: 'color-mix(in srgb, var(--paper) 55%, var(--sheet))' }}
    >
      {children}
    </th>
  );
}
