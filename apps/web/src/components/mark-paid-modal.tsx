'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { formatInr, type DueActionResult } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Modal, ErrorNote } from '@/components/ui';

export interface MarkPaidTarget {
  dueId: string;
  studentName: string;
  installmentNumber: number;
  amount: number;
}

export function MarkPaidModal({
  target,
  onClose,
}: {
  target: MarkPaidTarget | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<DueActionResult>(`/dues/${target!.dueId}/mark-paid`, {
        paidAmount: amount ? Number(amount) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      toast.show(`Marked installment ${target!.installmentNumber} paid for ${target!.studentName}.`);
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['student'] });
      close();
    },
    onError: (err) => setError(err instanceof ApiError ? err.body.message : 'Could not save.'),
  });

  function close() {
    setAmount('');
    setNote('');
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={!!target}
      onClose={close}
      title="Record payment"
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Mark paid
          </button>
        </>
      }
    >
      {target ? (
        <div className="flex flex-col gap-4">
          {error ? <ErrorNote message={error} /> : null}
          <p className="text-sm text-ink-soft">
            Recording payment for <b className="text-ink">{target.studentName}</b>, installment{' '}
            {target.installmentNumber}. Full amount is{' '}
            <span className="mono">{formatInr(target.amount)}</span>. This sends a “payment received”
            email to the parent.
          </p>
          <div>
            <label htmlFor="amt" className="label block mb-1.5">
              Amount received (optional)
            </label>
            <input
              id="amt"
              type="number"
              className="field mono"
              placeholder={String(target.amount)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="note" className="label block mb-1.5">
              Note (optional)
            </label>
            <input
              id="note"
              className="field"
              placeholder="e.g. Paid by UPI at the office"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
