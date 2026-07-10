'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Pencil, Plus, Upload } from 'lucide-react';
import type { Paginated, StudentView } from '@app/types';
import { api, qs } from '@/lib/api';
import { useAcademicYears, useClasses } from '@/lib/queries';
import { isAdmin, useSession } from '@/lib/session';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { StudentFormModal } from '@/components/student-form-modal';
import { ImportModal } from '@/components/import-modal';

export default function StudentsPage() {
  const session = useSession();
  const admin = isAdmin(session.data?.user);
  const years = useAcademicYears();
  const classes = useClasses();

  const [schoolClassId, setSchoolClassId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<StudentView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const students = useQuery<Paginated<StudentView>>({
    queryKey: ['students', schoolClassId, search, page],
    queryFn: () =>
      api.get<Paginated<StudentView>>(
        '/students' + qs({ schoolClassId: schoolClassId || undefined, search: search || undefined, page, pageSize: 25 }),
      ),
    placeholderData: (p) => p,
  });

  const data = students.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Roll"
        title="Students"
        subtitle="The register of students and their parent contacts. Dues are generated automatically from each class's fee structure."
        actions={
          admin ? (
            <>
              <button className="btn btn-ghost" onClick={() => setImportOpen(true)}>
                <Upload size={15} /> Import CSV
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus size={15} /> Add student
              </button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="flex flex-col gap-1.5">
          <span className="label">Class</span>
          <select
            className="field"
            value={schoolClassId}
            onChange={(e) => {
              setSchoolClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` ${c.section}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 grow max-w-xs">
          <span className="label">Search</span>
          <input
            className="field"
            placeholder="Name, reg ID or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {students.isLoading ? (
        <div className="card">
          <Spinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          message={admin ? 'Add students one at a time, or import a CSV roster.' : 'No students match these filters.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[680px]">
              <thead>
                <tr>
                  <Th>Reg ID</Th>
                  <Th>Student</Th>
                  <Th>Class</Th>
                  <Th>Parent</Th>
                  <Th>Contact</Th>
                  {admin ? <Th right /> : null}
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="group">
                    <td className="reg-cell mono text-[13px] text-ink-soft">{s.regId}</td>
                    <td className="reg-cell">
                      <Link href={`/students/${s.id}`} className="font-semibold hover:text-seal">
                        {s.name}
                      </Link>
                      {!s.isActive ? <span className="label ml-2">Inactive</span> : null}
                    </td>
                    <td className="reg-cell text-sm">
                      {s.className}
                      {s.section ? ` ${s.section}` : ''}
                    </td>
                    <td className="reg-cell text-sm">{s.parentName}</td>
                    <td className="reg-cell mono text-[13px] text-ink-soft">{s.parentEmail}</td>
                    {admin ? (
                      <td className="reg-cell text-right">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditing(s);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-rule text-sm text-ink-soft">
            <span className="mono">{data.total} students</span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="mono text-xs">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editing}
        classes={classes.data ?? []}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} years={years.data ?? []} />
    </>
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
