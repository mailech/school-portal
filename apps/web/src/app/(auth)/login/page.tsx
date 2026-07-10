'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookMarked, Loader2 } from 'lucide-react';
import { loginSchema, type LoginDto } from '@app/types';
import { useLogin } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { ErrorNote } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.replace('/dues');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.body.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — the ledger cover */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12"
        style={{ background: 'var(--sidebar)', color: 'var(--sidebar-ink)' }}
      >
        <div className="flex items-center gap-2.5">
          <BookMarked size={22} style={{ color: 'var(--seal)' }} />
          <span className="font-display font-bold text-lg tracking-tight" style={{ color: '#fff' }}>
            Fee Dues Register
          </span>
        </div>
        <div className="max-w-md">
          <p className="label mb-3" style={{ color: 'var(--sidebar-ink-soft)' }}>
            Accounts office
          </p>
          <h1 className="font-display font-bold text-4xl leading-[1.1] mb-4" style={{ color: '#fff' }}>
            Every installment, at a glance.
          </h1>
          <p style={{ color: 'var(--sidebar-ink-soft)' }} className="text-[15px] leading-relaxed">
            Track fee dues class by class, send reminders automatically, and confirm payments the
            moment a parent replies — one ledger for the whole school.
          </p>
        </div>
        <p className="text-xs" style={{ color: 'var(--sidebar-ink-soft)' }}>
          Staff access only. All actions are recorded.
        </p>
      </aside>

      {/* Form */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <BookMarked size={22} style={{ color: 'var(--seal)' }} />
            <span className="font-display font-bold text-lg">Fee Dues Register</span>
          </div>
          <h2 className="text-2xl font-bold text-ink mb-1">Sign in</h2>
          <p className="text-ink-soft text-sm mb-7">Use the credentials issued by your administrator.</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {formError ? <ErrorNote message={formError} /> : null}
            <div>
              <label htmlFor="email" className="label block mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="field"
                placeholder="you@school.edu"
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-xs mt-1.5" style={{ color: 'var(--red-ink)' }}>
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="password" className="label block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="field"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs mt-1.5" style={{ color: 'var(--red-ink)' }}>
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            <button type="submit" className="btn btn-primary mt-1" disabled={login.isPending}>
              {login.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
