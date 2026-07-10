import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDashed,
  MailQuestion,
  type LucideIcon,
} from 'lucide-react';
import {
  STATUS_META,
  formatInr,
  type PaymentDueStatus,
  type StatusTone,
} from '@app/types';

const stampTone: Record<StatusTone, string> = {
  neutral: 'stamp-gray',
  info: 'stamp-blue',
  danger: 'stamp-red',
  warning: 'stamp-amber',
  success: 'stamp-green',
};

const dotTone: Record<StatusTone, string> = {
  neutral: 'dot-gray',
  info: 'dot-blue',
  danger: 'dot-red',
  warning: 'dot-amber',
  success: 'dot-green',
};

const statusIcon: Record<PaymentDueStatus, LucideIcon> = {
  UPCOMING: CircleDashed,
  REMINDED: Bell,
  OVERDUE: AlertTriangle,
  UNDER_REVIEW: MailQuestion,
  PAID: CheckCircle2,
};

export function StatusStamp({
  status,
  amount,
}: {
  status: PaymentDueStatus;
  amount?: number | null;
}) {
  const meta = STATUS_META[status];
  const Icon = statusIcon[status];
  return (
    <span className={`stamp ${stampTone[meta.tone]}`} title={meta.description}>
      <Icon aria-hidden />
      {meta.label}
      {amount != null && amount > 0 ? <span className="amt">{formatInr(amount)}</span> : null}
    </span>
  );
}

export function StatusDot({ status }: { status: PaymentDueStatus }) {
  const meta = STATUS_META[status];
  return <span className={`dot ${dotTone[meta.tone]}`} aria-hidden />;
}

export function StatusLegend() {
  const order: PaymentDueStatus[] = ['OVERDUE', 'UNDER_REVIEW', 'REMINDED', 'PAID', 'UPCOMING'];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
      {order.map((s) => (
        <span key={s} className="inline-flex items-center gap-2">
          <StatusDot status={s} />
          {STATUS_META[s].label} — {STATUS_META[s].description}
        </span>
      ))}
    </div>
  );
}
