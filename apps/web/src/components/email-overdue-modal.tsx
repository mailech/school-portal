'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import type { ManualBlastPreview } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Modal, ErrorNote, Spinner } from '@/components/ui';

export function EmailOverdueModal({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: { academicYearId?: string; schoolClassId?: string; installmentNumber?: number };
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState<ManualBlastPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    api
      .post<ManualBlastPreview>('/dues/email-overdue', { ...scope, confirm: false })
      .then(setPreview)
      .catch((err) => setError(err instanceof ApiError ? err.body.message : 'Failed to load preview.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = useMutation({
    mutationFn: () => api.post<ManualBlastPreview>('/dues/email-overdue', { ...scope, confirm: true }),
    onSuccess: (res) => {
      toast.show(`Queued ${res.queued} overdue ${res.queued === 1 ? 'notice' : 'notices'}.`);
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['emails'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.body.message : 'Could not send.'),
  });

  const count = preview?.targetDueCount ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email overdue students"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={send.isPending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => send.mutate()}
            disabled={send.isPending || !preview || count === 0}
          >
            {send.isPending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={15} />}
            Send {count > 0 ? count : ''} {count === 1 ? 'notice' : 'notices'}
          </button>
        </>
      }
    >
      {error ? <ErrorNote message={error} /> : null}
      {!preview && !error ? <Spinner label="Counting overdue dues…" /> : null}
      {preview ? (
        <div className="text-sm text-ink-soft leading-relaxed">
          {count === 0 ? (
            <p>There are no overdue dues in this view. Nothing to send.</p>
          ) : (
            <p>
              This will queue an overdue notice to{' '}
              <b className="text-ink">
                {preview.targetStudentCount} {preview.targetStudentCount === 1 ? 'parent' : 'parents'}
              </b>{' '}
              covering <b className="text-ink mono">{count}</b> overdue{' '}
              {count === 1 ? 'installment' : 'installments'}
              {scope.schoolClassId ? ' in this class' : ' across the register'}. Each email uses the
              overdue template.
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
