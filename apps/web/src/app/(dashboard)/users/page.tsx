'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Plus, UserRoundCheck, UserRoundX } from 'lucide-react';
import { UserRole, type UserView } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Spinner, Modal, ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';

export default function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const users = useQuery<UserView[]>({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const [addOpen, setAddOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserView | null>(null);

  const toggleActive = useMutation({
    mutationFn: (u: UserView) => api.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => {
      toast.show('Staff account updated.');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.body.message : 'Could not update.', 'error'),
  });

  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Staff"
        subtitle="Administrators manage the school and its settings; accountants work the register and reply queue."
        actions={
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add staff
          </button>
        }
      />

      {users.isLoading ? (
        <div className="card"><Spinner /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[620px]">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Last sign-in</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id} className="group">
                    <td className="reg-cell font-medium">
                      {u.name}
                      {!u.isActive ? <span className="label ml-2">Disabled</span> : null}
                    </td>
                    <td className="reg-cell mono text-[13px] text-ink-soft">{u.email}</td>
                    <td className="reg-cell">
                      <span className="stamp stamp-gray">{u.role}</span>
                    </td>
                    <td className="reg-cell text-sm text-ink-soft">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                        : 'Never'}
                    </td>
                    <td className="reg-cell text-right whitespace-nowrap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setResetUser(u)}>
                        <KeyRound size={14} /> Reset password
                      </button>
                      <button
                        className="btn btn-ghost btn-sm ml-2"
                        onClick={() => toggleActive.mutate(u)}
                        disabled={toggleActive.isPending}
                      >
                        {u.isActive ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
    </>
  );
}

function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.ACCOUNTANT);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post('/users', { name, email, role, password }),
    onSuccess: () => {
      toast.show('Staff account created.');
      qc.invalidateQueries({ queryKey: ['users'] });
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not create.'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff account"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Create account
          </button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {error ? <div className="sm:col-span-2"><ErrorNote message={error} /></div> : null}
        <label className="flex flex-col gap-1.5">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Role</span>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value={UserRole.ACCOUNTANT}>Accountant</option>
            <option value={UserRole.ADMIN}>Administrator</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label">Email</span>
          <input className="field mono" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label">Temporary password</span>
          <input className="field mono" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="text-xs text-ink-soft">
            Min 10 chars with upper, lower & a number. They'll be asked to change it.
          </span>
        </label>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserView | null; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post(`/users/${user!.id}/reset-password`, { newPassword: password }),
    onSuccess: () => {
      toast.show(`Password reset for ${user!.name}.`);
      setPassword('');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Could not reset.'),
  });

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={user ? `Reset password · ${user.name}` : 'Reset password'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={!password || save.isPending}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Reset password
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <ErrorNote message={error} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="label">New temporary password</span>
          <input className="field mono" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className="text-xs text-ink-soft">All of this user's sessions will be signed out immediately.</p>
      </div>
    </Modal>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`label font-semibold px-3.5 py-3 border-b border-rule-strong text-left ${right ? 'text-right' : ''}`}
      style={{ background: 'color-mix(in srgb, var(--paper) 55%, var(--sheet))' }}
    >
      {children}
    </th>
  );
}
