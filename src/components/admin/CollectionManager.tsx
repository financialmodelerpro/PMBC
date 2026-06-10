'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonPrimary,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { MediaPickerButton, type MediaBucket } from '@/components/admin/MediaPicker';

type Row = Record<string, unknown> & { id: string };

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'media'
  | 'select'
  | 'number'
  | 'checkbox'
  | 'stringList'
  | 'kvList';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  bucket?: MediaBucket;
  hint?: string;
  full?: boolean;
  placeholder?: string;
};

export type ListColumn = {
  key: string;
  label: string;
  badge?: boolean;
  render?: (row: Row) => string;
  width?: number;
};

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

export function CollectionManager({
  apiBase,
  fields,
  listColumns,
  newDefaults,
  itemLabel,
  enableReorder = false,
  statusTone,
  emptyHint = 'Nothing here yet. Create your first entry.',
}: {
  apiBase: string;
  fields: FieldDef[];
  listColumns: ListColumn[];
  newDefaults: Record<string, unknown>;
  itemLabel: (row: Row) => string;
  enableReorder?: boolean;
  statusTone?: (row: Row) => BadgeTone;
  emptyHint?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows((json.rows ?? []) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing({ id: '', ...newDefaults } as Row);
    setIsNew(true);
  };
  const openEdit = (row: Row) => {
    setEditing({ ...row });
    setIsNew(false);
  };
  const close = () => {
    setEditing(null);
    setIsNew(false);
  };

  const reorder = useCallback(
    async (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= rows.length) return;
      const a = rows[index];
      const b = rows[target];
      const ao = (a.display_order as number) ?? index;
      const bo = (b.display_order as number) ?? target;
      // optimistic
      const next = [...rows];
      next[index] = b;
      next[target] = a;
      setRows(next);
      await Promise.all([
        fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, display_order: bo }),
        }),
        fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: b.id, display_order: ao }),
        }),
      ]);
      load();
    },
    [rows, apiBase, load],
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 14,
        }}
      >
        <button type="button" style={adminButtonPrimary} onClick={openNew}>
          <Plus size={15} /> New entry
        </button>
      </div>

      {error && (
        <div
          style={{
            ...adminBadge('danger'),
            display: 'block',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 44, textAlign: 'center', color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
            {emptyHint}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                {enableReorder && <th style={{ ...thStyle, width: 70 }}>Order</th>}
                {listColumns.map((c) => (
                  <th key={c.key} style={{ ...thStyle, width: c.width }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ ...thStyle, width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  {enableReorder && (
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => reorder(i, -1)}
                          style={{ ...miniBtn, opacity: i === 0 ? 0.3 : 1 }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={i === rows.length - 1}
                          onClick={() => reorder(i, 1)}
                          style={{ ...miniBtn, opacity: i === rows.length - 1 ? 0.3 : 1 }}
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                  {listColumns.map((c) => {
                    const text = c.render ? c.render(row) : String(row[c.key] ?? '');
                    return (
                      <td key={c.key} style={tdStyle}>
                        {c.badge && statusTone ? (
                          <span style={adminBadge(statusTone(row))}>{text || '—'}</span>
                        ) : c.key === listColumns[0].key ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: ADMIN_COLORS.textHeading,
                              fontWeight: 600,
                              fontSize: 13,
                              textAlign: 'left',
                            }}
                          >
                            {text || 'Untitled'}
                          </button>
                        ) : (
                          <span>{text}</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      style={{ ...adminButtonGhost, padding: '5px 12px' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditorDrawer
          apiBase={apiBase}
          fields={fields}
          row={editing}
          isNew={isNew}
          title={isNew ? 'New entry' : itemLabel(editing)}
          onClose={close}
          onSaved={() => {
            close();
            load();
          }}
        />
      )}
    </div>
  );
}

function EditorDrawer({
  apiBase,
  fields,
  row,
  isNew,
  title,
  onClose,
  onSaved,
}: {
  apiBase: string;
  fields: FieldDef[];
  row: Row;
  isNew: boolean;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(row);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) payload[f.key] = form[f.key];
      let res: Response;
      if (isNew) {
        res = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.id, ...payload }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}?id=${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,37,64,0.45)' }} />
      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(640px, 100%)',
          background: ADMIN_COLORS.pageBg,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 48px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            background: '#fff',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={miniBtn}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {fields.map((f) => (
              <div key={f.key} style={{ gridColumn: '1 / -1' }}>
                <label style={adminLabel}>{f.label}</label>
                <FieldInput field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
                {f.hint && <p style={{ margin: '5px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>{f.hint}</p>}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '14px 22px',
            background: '#fff',
            borderTop: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <div>
            {!isNew && (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger, borderColor: '#F3C2C2' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {error && <span style={{ fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</span>}
            <button type="button" onClick={onClose} style={adminButtonGhost}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} style={adminButtonPrimary}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={adminTextarea}
        />
      );
    case 'richtext':
      return (
        <RichTextEditor value={(value as string) ?? ''} onChange={(html) => onChange(html)} />
      );
    case 'media':
      return (
        <MediaPickerButton
          value={(value as string) ?? ''}
          bucket={field.bucket ?? 'cms-assets'}
          label={field.label}
          onChange={(url) => onChange(url)}
        />
      );
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} style={adminInput}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'number':
      return (
        <input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          style={adminInput}
        />
      );
    case 'checkbox':
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: ADMIN_COLORS.textBody }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          Enabled
        </label>
      );
    case 'stringList':
      return <StringListInput value={(value as string[]) ?? []} onChange={onChange} placeholder={field.placeholder} />;
    case 'kvList':
      return <KvListInput value={(value as Array<{ label: string; value: string }>) ?? []} onChange={onChange} />;
    case 'text':
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={adminInput}
        />
      );
  }
}

function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {value.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={item} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} style={adminInput} />
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            style={miniBtn}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" style={{ ...adminButtonGhost, alignSelf: 'flex-start' }} onClick={() => onChange([...value, ''])}>
        <Plus size={14} /> Add item
      </button>
    </div>
  );
}

function KvListInput({
  value,
  onChange,
}: {
  value: Array<{ label: string; value: string }>;
  onChange: (v: Array<{ label: string; value: string }>) => void;
}) {
  const update = (i: number, key: 'label' | 'value', v: string) => {
    const next = value.map((row, j) => (j === i ? { ...row, [key]: v } : row));
    onChange(next);
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {value.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={row.label} placeholder="Label" onChange={(e) => update(i, 'label', e.target.value)} style={adminInput} />
          <input type="text" value={row.value} placeholder="Value" onChange={(e) => update(i, 'value', e.target.value)} style={adminInput} />
          <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))} style={miniBtn}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        style={{ ...adminButtonGhost, alignSelf: 'flex-start' }}
        onClick={() => onChange([...value, { label: '', value: '' }])}
      >
        <Plus size={14} /> Add metric
      </button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textMuted,
  textAlign: 'left',
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: ADMIN_COLORS.textBody,
  borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`,
  verticalAlign: 'middle',
};

const miniBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  border: `1px solid ${ADMIN_COLORS.border}`,
  background: '#fff',
  color: ADMIN_COLORS.textMuted,
  cursor: 'pointer',
};
