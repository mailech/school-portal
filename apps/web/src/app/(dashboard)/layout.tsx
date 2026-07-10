'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { Spinner } from '@/components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Dead/expired session: clear the stale cookies, then land on /login.
    // Clearing avoids a blank redirect loop (invalid-but-present cookie).
    if (isError) {
      void api
        .post('/auth/logout')
        .catch(() => undefined)
        .finally(() => router.replace('/login'));
    }
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner label="Loading your workspace…" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen lg:pl-[248px]">
      <Sidebar user={data.user} />
      <main className="px-5 py-7 sm:px-8 sm:py-8 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}
