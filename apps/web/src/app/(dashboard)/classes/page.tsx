'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Layers, Loader2, Plus, Receipt } from 'lucide-react';
import type { SchoolClassView } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useAcademicYears, useClasses } from '@/lib/queries';
import { PageHeader, Spinner, EmptyState, Modal, ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';
import { FeeEditorModal } from '@/components/fee-editor-modal';

export default function ClassesPage() {
  const years = useAcademicYears();
  const activeYear = years.data?.find((y) => y.isActive) ?? years.data?.[0];
  const [yearId, setYearId] = useState('');
  const effectiveYear = yearId || activeYear?.id;
  const classes = useClasses(effectiveYear);

  const [feeClass, setFeeClass] = useState<SchoolClassView | null>(null);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [addYearOpen, setAddYearOpen] = useState(false);

  const noYears = years.isFetched && (years.data?.length ?? 0) === 0;

  return (
    <>
      <PageHeader
        eyebrow="Structure"
        title="Classes & fees"
        subtitle="Set each class's total fee and split it into installments. Changing a fee updates every student's dues."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setAddYearOpen(true)}>
              <CalendarPlus size={15} /> Academic year
            </button>
            {!noYears ? (
              <button className="btn btn-primary" onClick={() => setAddClassOpen(true)}>
                <Plus size={15} /> Add class
              </button>
            ) : null}
          </>
        }
      />

      {noYears ? (
        <EmptyState
          icon={CalendarPlus}
          title="Start with an academic year"
          message="Create an academic year (e.g. 2026-27), then add classes and their fee structures."
          action={
            <button className="btn btn-primary" onClick={() => setAddYearOpen(true)}>
              Create academic year
            </button>
          }
        />
      ) : (
        <>
          <label className="flex flex-col gap-1.5 mb-5 max-w-[220px]">
            <span className="label">Academic year</span>
            <select className="field" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.data?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isActive ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </label>

          {classes.isLoading ? (
            <div className="card">
              <Spinner />
            </div>
          ) : (classes.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Layers}
              title="No classes yet"
              message="Add your first class for this year to begin tracking dues."
              action={
                <button className="btn btn-primary" onClick={() => setAddClassOpen(true)}>
                  Add class
                </button>
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {classes.data?.map((c) => (
                <div key={c.id} className="card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display font-bold text-lg">
                        {c.name}
                        {c.section ? ` ${c.section}` : ''}
                      </h3>
                      <p className="text-sm text-ink-soft mono">{c.studentCount} students</p>
                    </div>
                    <span
                      className="stamp"
                      style={
                        c.hasFeeStructure
                          ? { color: 'var(--green-ink)', background: 'var(--green-bg)', borderColor: 'var(--green-line)' }
                          : { color: 'var(--amber-ink)', background: 'var(--amber-bg)', borderColor: 'var(--amber-line)' }
                      }
                    >
                      {c.hasFeeStructure ? 'Fees set' : 'No fees'}
                    </span>
                  </div>
                  <div className="mono text-sm text-ink-soft">
                    {c.totalAmount != null ? `Total ₹${c.totalAmount.toLocaleString('en-IN')}` : 'Total not set'}
                  </div>
                  <button className="btn btn-ghost btn-sm self-start mt-1" onClick={() => setFeeClass(c)}>
                    <Receipt size={14} /> {c.hasFeeStructure ? 'Edit fees' : 'Set fees'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <FeeEditorModal klass={feeClass} onClose={() => setFeeClass(null)} />
      <AddClassModal open={addClassOpen} onClose={() => setAddClassOpen(false)} academicYearId={effectiveYear} />
      <AddYearModal open={addYearOpen} onClose={() => setAddYearOpen(false)} />
    </>
  );
}

function AddClassModal({
  open,
  onClose,
  academicYearId,
}: {
  open: boolean;
  onClose: () => void;
  academicYearId?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post('/classes', { name, section: section || undefined, academicYearId }),
    onSuccess: () => {
      toast.show('Class added.');
      qc.invalidateQueries({ queryKey: ['classes'] });
      setName('');
      setSection('');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not add class.'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add class"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={!name || save.isPending}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Add class
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {error ? (
          <div className="w-full">
            <ErrorNote message={error} />
          </div>
        ) : null}
        <label className="flex flex-col gap-1.5 grow">
          <span className="label">Class name</span>
          <input className="field" placeholder="Grade 5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 w-28">
          <span className="label">Section</span>
          <input className="field" placeholder="A" value={section} onChange={(e) => setSection(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

function AddYearModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post('/academic-years', { label, isActive }),
    onSuccess: () => {
      toast.show('Academic year created.');
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      setLabel('');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not create year.'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add academic year"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={!label || save.isPending}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Create
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote message={error} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="label">Label</span>
          <input className="field" placeholder="2026-27" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Set as the active year
        </label>
      </div>
    </Modal>
  );
}
