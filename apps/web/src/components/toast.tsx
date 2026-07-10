'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, X, AlertCircle } from 'lucide-react';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  show: (message: string, kind?: ToastKind) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2.5rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="card flex items-start gap-3 p-3.5 shadow-pop"
            style={{ borderColor: t.kind === 'error' ? 'var(--red-line)' : 'var(--green-line)' }}
          >
            {t.kind === 'error' ? (
              <AlertCircle size={18} style={{ color: 'var(--red-ink)' }} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={18} style={{ color: 'var(--green-ink)' }} className="mt-0.5 shrink-0" />
            )}
            <p className="text-sm leading-snug flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-faint hover:text-ink">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
