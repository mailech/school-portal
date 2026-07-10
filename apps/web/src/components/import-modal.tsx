'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import type { AcademicYearView, ImportResult } from '@app/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Modal, ErrorNote } from '@/components/ui';

type Row = Record<string, string>;

// Header aliases so office spreadsheets don't have to match our field names exactly.
const HEADER_MAP: Record<string, string> = {
  name: 'name',
  'student name': 'name',
  regid: 'regId',
  'reg id': 'regId',
  'registration id': 'regId',
  roll: 'regId',
  class: 'className',
  'class name': 'className',
  section: 'section',
  'parent name': 'parentName',
  parent: 'parentName',
  'parent mobile': 'parentMobile',
  mobile: 'parentMobile',
  phone: 'parentMobile',
  'parent email': 'parentEmail',
  email: 'parentEmail',
};

function normalizeRows(rows: Row[]): Row[] {
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      const key = HEADER_MAP[k.trim().toLowerCase()] ?? k.trim();
      out[key] = (v ?? '').toString().trim();
    }
    return out;
  });
}

export function ImportModal({
  open,
  onClose,
  years,
}: {
  open: boolean;
  onClose: () => void;
  years: AcademicYearView[];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const activeYear = years.find((y) => y.isActive) ?? years[0];
  const [academicYearId, setAcademicYearId] = useState(activeYear?.id ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setFileName('');
    setResult(null);
    setError(null);
  }

  function onFile(file: File) {
    setError(null);
    setResult(null);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(normalizeRows(res.data));
        setFileName(file.name);
      },
      error: () => setError('Could not read that file. Please upload a valid CSV.'),
    });
  }

  const run = useMutation({
    mutationFn: (commit: boolean) =>
      api.post<ImportResult>('/students/import', { academicYearId, rows, commit }),
    onSuccess: (res, commit) => {
      setResult(res);
      if (commit) {
        toast.show(`Imported ${res.created} new and updated ${res.updated} student(s).`);
        qc.invalidateQueries({ queryKey: ['students'] });
        qc.invalidateQueries({ queryKey: ['board'] });
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.body.message : 'Import failed.'),
  });

  const canRun = !!academicYearId && rows.length > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import students"
      width={640}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => run.mutate(false)} disabled={!canRun || run.isPending}>
            {run.isPending && !run.variables ? <Loader2 size={16} className="animate-spin" /> : null}
            Check rows
          </button>
          <button
            className="btn btn-primary"
            onClick={() => run.mutate(true)}
            disabled={!canRun || run.isPending || (result != null && result.validRows === 0)}
          >
            {run.isPending && run.variables ? <Loader2 size={16} className="animate-spin" /> : null}
            Import {result ? `${result.validRows} valid` : ''}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote message={error} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="label">Academic year</span>
          <select className="field" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.isActive ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rule-strong py-8 cursor-pointer hover:bg-paper/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
          }}
        >
          <UploadCloud size={24} className="text-ink-faint" />
          <span className="text-sm text-ink-soft">
            {fileName ? (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <FileUp size={14} /> {fileName} · {rows.length} rows
              </span>
            ) : (
              'Drop a CSV here, or click to choose'
            )}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        <p className="text-xs text-ink-soft">
          Columns: <span className="mono">name, regId, className, section, parentName, parentMobile,
          parentEmail</span>. Classes are matched by name (and section) within the selected year.
        </p>

        {result ? (
          <div className="rounded-lg border border-rule p-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 mono">
              <span>
                <b>{result.validRows}</b> valid
              </span>
              <span style={{ color: result.invalidRows ? 'var(--red-ink)' : undefined }}>
                <b>{result.invalidRows}</b> invalid
              </span>
              {result.committed ? (
                <span style={{ color: 'var(--green-ink)' }}>
                  <b>{result.created}</b> created · <b>{result.updated}</b> updated
                </span>
              ) : null}
            </div>
            {result.errors.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 max-h-40 overflow-auto">
                {result.errors.slice(0, 40).map((err, i) => (
                  <li key={i} className="text-xs" style={{ color: 'var(--red-ink)' }}>
                    Row {err.rowNumber}
                    {err.regId ? ` (${err.regId})` : ''}: {err.errors.join('; ')}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
