'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { amountsSumTo, formatInr, type FeeStructureView, type SchoolClassView } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Modal, ErrorNote } from '@/components/ui';

interface Row {
  amount: string;
  dueDate: string;
}

const emptyRows = (n: number): Row[] => Array.from({ length: n }, () => ({ amount: '', dueDate: '' }));

export function FeeEditorModal({
  klass,
  onClose,
}: {
  klass: SchoolClassView | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [total, setTotal] = useState('');
  const [rows, setRows] = useState<Row[]>(emptyRows(3));
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery<FeeStructureView | null>({
    queryKey: ['fee', klass?.id],
    queryFn: () => api.get<FeeStructureView>(`/fees/class/${klass!.id}`).catch(() => null),
    enabled: !!klass,
  });

  useEffect(() => {
    if (!klass) return;
    if (existing.data) {
      setTotal(String(existing.data.totalAmount));
      setRows(
        existing.data.installments.map((i) => ({
          amount: String(i.amount),
          dueDate: i.dueDate.slice(0, 10),
        })),
      );
    } else if (existing.isFetched) {
      setTotal('');
      setRows(emptyRows(3));
    }
    setError(null);
  }, [klass, existing.data, existing.isFetched]);

  const parsedAmounts = rows.map((r) => Number(r.amount) || 0);
  const sum = parsedAmounts.reduce((a, b) => a + b, 0);
  const totalNum = Number(total) || 0;
  const sumsMatch = total !== '' && amountsSumTo(totalNum, parsedAmounts);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/fees`, {
        schoolClassId: klass!.id,
        totalAmount: totalNum,
        installments: rows.map((r, i) => ({
          installmentNumber: i + 1,
          amount: Number(r.amount),
          dueDate: r.dueDate,
        })),
      }),
    onSuccess: () => {
      toast.show('Fee structure saved. Student dues updated.');
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['fee'] });
      qc.invalidateQueries({ queryKey: ['board'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not save.'),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Modal
      open={!!klass}
      onClose={onClose}
      title={klass ? `Fees · ${klass.name}${klass.section ? ' ' + klass.section : ''}` : 'Fees'}
      width={620}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending || !sumsMatch || rows.some((r) => !r.dueDate || !r.amount)}
          >
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Save fee structure
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote message={error} /> : null}
        <label className="flex flex-col gap-1.5 max-w-[220px]">
          <span className="label">Total fee for the year</span>
          <input
            type="number"
            className="field mono"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="30000"
          />
        </label>

        <div>
          <div className="label mb-2">Installments</div>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="mono text-sm text-ink-soft w-6">#{i + 1}</span>
                <input
                  type="number"
                  className="field mono"
                  placeholder="Amount"
                  value={r.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                />
                <input
                  type="date"
                  className="field mono"
                  value={r.dueDate}
                  onChange={(e) => update(i, { dueDate: e.target.value })}
                />
                {rows.length > 1 ? (
                  <button
                    className="text-ink-faint hover:text-ink p-2"
                    aria-label="Remove installment"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {rows.length < 12 ? (
            <button
              className="btn btn-ghost btn-sm mt-2"
              onClick={() => setRows((rs) => [...rs, { amount: '', dueDate: '' }])}
            >
              <Plus size={14} /> Add installment
            </button>
          ) : null}
        </div>

        <div
          className="rounded-lg border px-3.5 py-2.5 text-sm flex justify-between mono"
          style={{
            background: sumsMatch ? 'var(--green-bg)' : 'var(--amber-bg)',
            borderColor: sumsMatch ? 'var(--green-line)' : 'var(--amber-line)',
            color: sumsMatch ? 'var(--green-ink)' : 'var(--amber-ink)',
          }}
        >
          <span>Installments total</span>
          <span>
            {formatInr(sum)} {total ? `/ ${formatInr(totalNum)}` : ''}
            {sumsMatch ? ' ✓' : ''}
          </span>
        </div>
      </div>
    </Modal>
  );
}
