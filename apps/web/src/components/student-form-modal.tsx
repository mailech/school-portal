'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  createStudentSchema,
  type CreateStudentDto,
  type SchoolClassView,
  type StudentView,
} from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Modal, ErrorNote } from '@/components/ui';

export function StudentFormModal({
  open,
  onClose,
  student,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  student?: StudentView | null;
  classes: SchoolClassView[];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const editing = !!student;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStudentDto>({ resolver: zodResolver(createStudentSchema) });

  useEffect(() => {
    if (open) {
      setError(null);
      reset(
        student
          ? {
              name: student.name,
              regId: student.regId,
              schoolClassId: student.schoolClassId,
              parentName: student.parentName,
              parentMobile: student.parentMobile,
              parentEmail: student.parentEmail,
              isActive: student.isActive,
            }
          : { isActive: true },
      );
    }
  }, [open, student, reset]);

  const mutation = useMutation({
    mutationFn: (values: CreateStudentDto) =>
      editing ? api.patch(`/students/${student!.id}`, values) : api.post('/students', values),
    onSuccess: () => {
      toast.show(editing ? 'Student updated.' : 'Student added.');
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['board'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not save.'),
  });

  const onSubmit = handleSubmit((v) => mutation.mutate(v));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit student' : 'Add student'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            {editing ? 'Save changes' : 'Add student'}
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4">
        {error ? (
          <div className="sm:col-span-2">
            <ErrorNote message={error} />
          </div>
        ) : null}
        <FormField label="Full name" error={errors.name?.message}>
          <input className="field" {...register('name')} />
        </FormField>
        <FormField label="Registration ID" error={errors.regId?.message}>
          <input className="field mono" {...register('regId')} />
        </FormField>
        <FormField label="Class" error={errors.schoolClassId?.message} full>
          <select className="field" {...register('schoolClassId')}>
            <option value="">Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` ${c.section}` : ''}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Parent name" error={errors.parentName?.message}>
          <input className="field" {...register('parentName')} />
        </FormField>
        <FormField label="Parent mobile" error={errors.parentMobile?.message}>
          <input className="field mono" {...register('parentMobile')} />
        </FormField>
        <FormField label="Parent email" error={errors.parentEmail?.message} full>
          <input className="field mono" {...register('parentEmail')} />
        </FormField>
      </form>
    </Modal>
  );
}

function FormField({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="text-xs" style={{ color: 'var(--red-ink)' }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
