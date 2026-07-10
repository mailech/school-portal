'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { Loader2, Moon, Sun, X, type LucideIcon } from 'lucide-react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-soft text-sm py-8 justify-center">
      <Loader2 size={16} className="animate-spin" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow ? <div className="label mb-1">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="text-ink-soft mt-1 text-sm max-w-prose">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center gap-3 py-14 px-6">
      <div
        className="grid place-items-center h-11 w-11 rounded-full"
        style={{ background: 'var(--seal-soft)', color: 'var(--seal)' }}
      >
        <Icon size={20} />
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="text-ink-soft text-sm max-w-sm">{message}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg border px-3.5 py-2.5 text-sm"
      style={{ background: 'var(--red-bg)', borderColor: 'var(--red-line)', color: 'var(--red-ink)' }}
    >
      {message}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid place-items-center h-9 w-9 rounded-lg border border-rule-strong bg-sheet hover:bg-paper text-ink-soft hover:text-ink"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 grid place-items-center p-4"
      style={{ background: 'rgba(15,21,23,.45)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full shadow-pop max-h-[90vh] overflow-auto"
        style={{ maxWidth: width, background: 'var(--sheet)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-rule sticky top-0 bg-sheet">
          <h2 className="font-semibold text-ink text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-rule bg-sheet sticky bottom-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
