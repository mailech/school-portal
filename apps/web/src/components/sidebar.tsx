'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookMarked,
  GraduationCap,
  Inbox,
  Layers,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Table2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CurrentUser } from '@app/types';
import { isAdmin, useLogout } from '@/lib/session';
import { ThemeToggle } from './ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dues', label: 'Dues board', icon: Table2 },
  { href: '/replies', label: 'Reply queue', icon: Inbox },
  { href: '/students', label: 'Students', icon: GraduationCap },
  { href: '/classes', label: 'Classes & fees', icon: Layers, adminOnly: true },
  { href: '/settings', label: 'Templates & settings', icon: Settings, adminOnly: true },
  { href: '/users', label: 'Staff', icon: UsersRound, adminOnly: true },
  { href: '/logs', label: 'Email & audit log', icon: ScrollText },
];

function NavList({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || isAdmin(user));
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: active ? 'var(--sidebar-active)' : 'transparent',
              color: active ? '#fff' : 'var(--sidebar-ink)',
            }}
          >
            <Icon size={17} style={{ opacity: active ? 1 : 0.8 }} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const logout = useLogout();
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,.05)' }}
      >
        <div
          className="grid place-items-center h-8 w-8 rounded-full text-xs font-semibold shrink-0"
          style={{ background: 'var(--seal)', color: '#fff' }}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm truncate" style={{ color: '#fff' }}>
            {user.name}
          </p>
          <p className="text-xs capitalize" style={{ color: 'var(--sidebar-ink-soft)' }}>
            {user.role.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={async () => {
            await logout.mutateAsync();
            router.replace('/login');
          }}
          className="btn btn-sm flex-1"
          style={{ background: 'rgba(255,255,255,.06)', color: 'var(--sidebar-ink)', border: 'none' }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 border-b"
        style={{ background: 'var(--sidebar)', borderColor: 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <BookMarked size={19} style={{ color: 'var(--seal)' }} />
          <span className="font-display font-bold" style={{ color: '#fff' }}>
            Fee Dues Register
          </span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" style={{ color: '#fff' }}>
          <Menu size={22} />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col p-4 gap-6"
        style={{ background: 'var(--sidebar)' }}
      >
        <div className="flex items-center gap-2.5 px-2 pt-1">
          <BookMarked size={20} style={{ color: 'var(--seal)' }} />
          <span className="font-display font-bold tracking-tight" style={{ color: '#fff' }}>
            Fee Dues Register
          </span>
        </div>
        <NavList user={user} />
        <Footer user={user} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(15,21,23,.5)' }} />
          <aside
            className="absolute inset-y-0 left-0 w-[248px] flex flex-col p-4 gap-6"
            style={{ background: 'var(--sidebar)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="font-display font-bold" style={{ color: '#fff' }}>
                Menu
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" style={{ color: '#fff' }}>
                <X size={20} />
              </button>
            </div>
            <NavList user={user} onNavigate={() => setOpen(false)} />
            <Footer user={user} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
