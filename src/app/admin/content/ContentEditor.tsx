'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonIcon,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminInput,
  adminTextarea,
} from '@/lib/admin/styles';
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
  deletes: string[];
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
          rows: [...sec.rows, { key: '', value: '', multiline: false, isNew: true }],
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

    const extraDeletes: string[] = [];
    for (const r of sec.rows) {
      if (r.originalKey && r.originalKey !== r.key) {
        extraDeletes.push(r.originalKey);
      }
    }

    updateSection(section, { state: 'saving', errMsg: undefined });
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
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
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          padding: 24,
          fontSize: 13,
          color: ADMIN_COLORS.textMuted,
        }}
      >
        No cms_content rows found. Run migration 006 to seed defaults.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {grouped.map(([sectionName]) => {
          const sec = sections[sectionName];
          return (
            <div
              key={sectionName}
              style={{
                background: '#FFFFFF',
                border: `1px solid ${ADMIN_COLORS.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => updateSection(sectionName, { open: !sec.open })}
                style={accordionToggleStyle}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: ADMIN_COLORS.textMuted,
                    }}
                  >
                    Section
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 13,
                      color: ADMIN_COLORS.textHeading,
                    }}
                  >
                    {sectionName}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                    {sec.rows.length} keys
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      color: ADMIN_COLORS.textMicro,
                      transform: sec.open ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 120ms ease',
                    }}
                  />
                </div>
              </button>

              {sec.open && (
                <div
                  style={{
                    padding: 18,
                    borderTop: `1px solid ${ADMIN_COLORS.border}`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sec.rows.map((r, idx) => (
                      <RowEditor
                        key={`${sectionName}-${idx}`}
                        row={r}
                        onChange={(patch) => updateRow(sectionName, idx, patch)}
                        onDelete={() => requestDelete(sectionName, idx)}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: `1px solid #F3F4F6`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => addRow(sectionName)}
                      style={adminButtonGhost}
                    >
                      <Plus size={13} /> Add key
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <SaveStatus state={sec.state} message={sec.errMsg} />
                      <button
                        type="button"
                        onClick={() => saveSection(sectionName)}
                        disabled={sec.state === 'saving'}
                        style={
                          sec.state === 'saving'
                            ? adminButtonPrimaryDisabled
                            : adminButtonPrimary
                        }
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

const accordionToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
  padding: '14px 18px',
  background: '#FFFFFF',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

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
  const keyInputStyle: CSSProperties = {
    ...adminInput,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    border: `1px solid ${keyValid ? ADMIN_COLORS.borderInput : '#FCA5A5'}`,
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr auto',
        gap: 8,
        alignItems: 'start',
      }}
    >
      <div>
        <input
          type="text"
          value={row.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder="key_name"
          style={keyInputStyle}
        />
        <label
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: ADMIN_COLORS.textMuted,
          }}
        >
          <input
            type="checkbox"
            checked={row.multiline}
            onChange={(e) => onChange({ multiline: e.target.checked })}
            style={{ width: 12, height: 12 }}
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
            style={adminTextarea}
          />
        ) : (
          <input
            type="text"
            value={row.value}
            onChange={(e) => onChange({ value: e.target.value })}
            style={adminInput}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        style={adminButtonIcon}
        aria-label="Delete row"
        title="Delete row"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
