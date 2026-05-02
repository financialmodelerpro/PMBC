'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { ContentRow } from '@/lib/cms/content';

type Row = {
  key: string;
  value: string;
  multiline: boolean;
  isNew?: boolean;
  originalKey?: string;
};

type SectionState = {
  rows: Row[];
  deletes: string[]; // original keys to delete on save
  state: SaveState;
  errMsg?: string;
  open: boolean;
};

const KEY_RX = /^[a-zA-Z0-9_.-]+$/;

function shouldUseMultiline(value: string): boolean {
  return value.length > 80 || value.includes('\n');
}

function rowsFromInitial(initial: ContentRow[]): Row[] {
  return initial
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({
      key: r.key,
      value: r.value ?? '',
      multiline: shouldUseMultiline(r.value ?? ''),
      originalKey: r.key,
    }));
}

export function ContentEditor({ initial }: { initial: ContentRow[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, ContentRow[]>();
    for (const r of initial) {
      const arr = map.get(r.section) ?? [];
      arr.push(r);
      map.set(r.section, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [initial]);

  const [sections, setSections] = useState<Record<string, SectionState>>(() => {
    const out: Record<string, SectionState> = {};
    for (const [name, rows] of grouped) {
      out[name] = {
        rows: rowsFromInitial(rows),
        deletes: [],
        state: 'idle',
        open: true,
      };
    }
    return out;
  });

  const [pendingDelete, setPendingDelete] = useState<{
    section: string;
    rowIndex: number;
  } | null>(null);

  const updateSection = (name: string, patch: Partial<SectionState>) => {
    setSections((s) => ({ ...s, [name]: { ...s[name], ...patch } }));
  };

  const updateRow = (section: string, idx: number, patch: Partial<Row>) => {
    setSections((s) => {
      const sec = s[section];
      const rows = sec.rows.slice();
      rows[idx] = { ...rows[idx], ...patch };
      return { ...s, [section]: { ...sec, rows } };
    });
  };

  const addRow = (section: string) => {
    setSections((s) => {
      const sec = s[section];
      return {
        ...s,
        [section]: {
          ...sec,
          rows: [
            ...sec.rows,
            { key: '', value: '', multiline: false, isNew: true },
          ],
        },
      };
    });
  };

  const requestDelete = (section: string, idx: number) => {
    setPendingDelete({ section, rowIndex: idx });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { section, rowIndex } = pendingDelete;
    setSections((s) => {
      const sec = s[section];
      const row = sec.rows[rowIndex];
      const rows = sec.rows.filter((_, i) => i !== rowIndex);
      const deletes =
        row.originalKey && !row.isNew ? [...sec.deletes, row.originalKey] : sec.deletes;
      return { ...s, [section]: { ...sec, rows, deletes } };
    });
    setPendingDelete(null);
  };

  const saveSection = async (section: string) => {
    const sec = sections[section];

    // Validate keys: non-empty, no duplicates, valid characters.
    const seen = new Set<string>();
    for (const r of sec.rows) {
      if (!r.key || !KEY_RX.test(r.key)) {
        updateSection(section, {
          state: 'error',
          errMsg: `Invalid key: "${r.key || '(empty)'}"`,
        });
        return;
      }
      if (seen.has(r.key)) {
        updateSection(section, { state: 'error', errMsg: `Duplicate key: ${r.key}` });
        return;
      }
      seen.add(r.key);
    }

    // For renamed keys, the original goes into deletes; the new key is upserted.
    const extraDeletes: string[] = [];
    for (const r of sec.rows) {
      if (r.originalKey && r.originalKey !== r.key) {
        extraDeletes.push(r.originalKey);
      }
    }

    updateSection(section, { state: 'saving', errMsg: undefined });
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          section,
          upserts: sec.rows.map((r) => ({ key: r.key, value: r.value })),
          deletes: [...sec.deletes, ...extraDeletes],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      // Mark new rows as no-longer-new and reset deletes; align originalKey.
      setSections((s) => {
        const cur = s[section];
        return {
          ...s,
          [section]: {
            ...cur,
            rows: cur.rows.map((r) => ({ ...r, isNew: false, originalKey: r.key })),
            deletes: [],
            state: 'saved',
          },
        };
      });
      setTimeout(() => updateSection(section, { state: 'idle' }), 2500);
    } catch (e) {
      updateSection(section, { state: 'error', errMsg: (e as Error).message });
    }
  };

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        No cms_content rows found. Run migration 006 to seed defaults.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {grouped.map(([sectionName]) => {
          const sec = sections[sectionName];
          return (
            <div
              key={sectionName}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,27,45,0.04)]"
            >
              <button
                type="button"
                onClick={() => updateSection(sectionName, { open: !sec.open })}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-neutral-500">
                    Section
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-[#0F1B2D]">{sectionName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500">{sec.rows.length} keys</span>
                  <ChevronDown
                    className={
                      'h-4 w-4 text-neutral-400 transition-transform ' +
                      (sec.open ? 'rotate-180' : '')
                    }
                  />
                </div>
              </button>

              {sec.open && (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <div className="space-y-3">
                    {sec.rows.map((r, idx) => (
                      <RowEditor
                        key={`${sectionName}-${idx}`}
                        row={r}
                        onChange={(patch) => updateRow(sectionName, idx, patch)}
                        onDelete={() => requestDelete(sectionName, idx)}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                    <button
                      type="button"
                      onClick={() => addRow(sectionName)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add key
                    </button>
                    <div className="flex items-center gap-3">
                      <SaveStatus state={sec.state} message={sec.errMsg} />
                      <button
                        type="button"
                        onClick={() => saveSection(sectionName)}
                        disabled={sec.state === 'saving'}
                        className="rounded-md bg-[#1B3A5F] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sec.state === 'saving' ? 'Saving…' : 'Save section'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this key?"
        body="The row will be removed when you save the section. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function RowEditor({
  row,
  onChange,
  onDelete,
}: {
  row: Row;
  onChange: (patch: Partial<Row>) => void;
  onDelete: () => void;
}) {
  const keyValid = !row.key || KEY_RX.test(row.key);
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto] md:items-start">
      <div>
        <input
          type="text"
          value={row.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder="key_name"
          className={
            'block w-full rounded-md border bg-white px-3 py-2 font-mono text-[13px] outline-none focus:ring-2 focus:ring-[#1B3A5F]/15 ' +
            (keyValid ? 'border-neutral-300 focus:border-[#1B3A5F]' : 'border-red-300 focus:border-red-500')
          }
        />
        <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
          <input
            type="checkbox"
            checked={row.multiline}
            onChange={(e) => onChange({ multiline: e.target.checked })}
            className="h-3 w-3"
          />
          Multiline
        </label>
      </div>
      <div>
        {row.multiline ? (
          <textarea
            value={row.value}
            onChange={(e) => onChange({ value: e.target.value })}
            rows={4}
            className="block w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
          />
        ) : (
          <input
            type="text"
            value={row.value}
            onChange={(e) => onChange({ value: e.target.value })}
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label="Delete row"
        title="Delete row"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
