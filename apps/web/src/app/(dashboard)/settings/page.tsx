'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import {
  EmailType,
  TEMPLATE_VARIABLES,
  type EmailTemplateView,
  type SettingsView,
} from '@app/types';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Spinner, ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';

const templateLabel: Record<string, string> = {
  [EmailType.PRE_DUE_REMINDER]: 'Pre-due reminder',
  [EmailType.OVERDUE_NOTICE]: 'Overdue notice',
  [EmailType.ESCALATION]: 'Escalation',
  [EmailType.PAYMENT_RECEIVED]: 'Payment received',
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Templates & settings"
        subtitle="Control when reminders go out and what parents receive. Timing changes apply on the next daily sweep."
      />
      <div className="flex flex-col gap-6 max-w-3xl">
        <TimingCard />
        <TemplatesCard />
      </div>
    </>
  );
}

function TimingCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useQuery<SettingsView>({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const [form, setForm] = useState<Partial<SettingsView>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/settings', {
        reminderOffsetDays: Number(form.reminderOffsetDays),
        overdueGraceDays: Number(form.overdueGraceDays),
        escalationOffsetDays: Number(form.escalationOffsetDays),
        dailySweepCron: form.dailySweepCron,
        timezone: form.timezone,
      }),
    onSuccess: () => {
      toast.show('Timing settings saved.');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not save.'),
  });

  if (settings.isLoading) return <div className="card"><Spinner /></div>;

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-lg mb-1">Reminder timing</h2>
      <p className="text-sm text-ink-soft mb-4">Offsets are counted in days around each installment's due date.</p>
      {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <NumField label="Remind this many days before due" value={form.reminderOffsetDays} onChange={(v) => setForm((f) => ({ ...f, reminderOffsetDays: v }))} />
        <NumField label="Grace days after due before overdue" value={form.overdueGraceDays} onChange={(v) => setForm((f) => ({ ...f, overdueGraceDays: v }))} />
        <NumField label="Escalate this many days after due" value={form.escalationOffsetDays} onChange={(v) => setForm((f) => ({ ...f, escalationOffsetDays: v }))} />
        <label className="flex flex-col gap-1.5">
          <span className="label">Daily sweep time (cron)</span>
          <input
            className="field mono"
            value={form.dailySweepCron ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, dailySweepCron: e.target.value }))}
          />
        </label>
      </div>
      <div className="mt-4">
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={15} />}
          Save timing
        </button>
      </div>
    </section>
  );
}

function TemplatesCard() {
  const templates = useQuery<EmailTemplateView[]>({ queryKey: ['templates'], queryFn: () => api.get('/templates') });
  const [openType, setOpenType] = useState<string | null>(null);

  if (templates.isLoading) return <div className="card"><Spinner /></div>;

  return (
    <section className="card">
      <div className="px-5 py-4 border-b border-rule">
        <h2 className="font-semibold text-lg">Email templates</h2>
        <p className="text-sm text-ink-soft mt-0.5">
          Variables: {TEMPLATE_VARIABLES.map((v) => <code key={v} className="mono text-xs mr-1">{`{${v}}`}</code>)}
        </p>
      </div>
      <div className="divide-y divide-rule">
        {templates.data?.map((t) => (
          <TemplateRow
            key={t.type}
            template={t}
            open={openType === t.type}
            onToggle={() => setOpenType((o) => (o === t.type ? null : t.type))}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateRow({
  template,
  open,
  onToggle,
}: {
  template: EmailTemplateView;
  open: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [bodyText, setBodyText] = useState(template.bodyText);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.put(`/templates/${template.type}`, { subject, bodyText, bodyHtml }),
    onSuccess: () => {
      toast.show(`${templateLabel[template.type]} template saved.`);
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not save.'),
  });

  return (
    <div className="px-5 py-3.5">
      <button className="flex items-center justify-between w-full text-left" onClick={onToggle}>
        <span className="font-medium">{templateLabel[template.type] ?? template.type}</span>
        <span className="label">{open ? 'Close' : 'Edit'}</span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          {error ? <ErrorNote message={error} /> : null}
          <label className="flex flex-col gap-1.5">
            <span className="label">Subject</span>
            <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Plain-text body</span>
            <textarea className="field font-sans" rows={5} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">HTML body</span>
            <textarea className="field mono text-xs" rows={4} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-sm self-start" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save template
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <input
        type="number"
        className="field mono"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
