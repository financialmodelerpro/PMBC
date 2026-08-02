'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Lock, Plus, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SaveButton } from '@/components/admin/SaveButton';
import { ToggleSwitch } from '@/components/admin/ToggleSwitch';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminInput,
} from '@/lib/admin/styles';

const API = '/api/admin/site-pages';

type NavRow = {
  id: string;
  label: string;
  href: string;
  display_order: number;
  visible: boolean;
  /** Absent until migration 033 runs. See supportsPinning below. */
  can_toggle?: boolean;
};

type Draft = { label: string; href: string };

/**
 * Pages and Nav, as an inline-edit table (FMP CMS_REFERENCE.md section 2.6,
 * parity 8).
 *
 * FMP edits nav items in place; PMBC used a slide-in drawer. A nav item is two
 * short strings and two booleans, so the drawer was more ceremony than the data
 * deserved. Editing happens in the row now.
 *
 * Save model, matching the split already used across the console:
 *   - label and href     pending until that row's Save (text needs a commit point)
 *   - visible and pinned save immediately (a switch that needs confirming is a lie)
 *   - reorder            saves immediately on click
 *   - create and delete  save immediately
 *
 * Dirty state is per row, never per table, for the same reason the page builder
 * tracks it per section in parity 3: one row's Save must not flush another
 * row's half-typed edit.
 */
export function SitePagesManager() {
  const [rows, setRows] = useState<NavRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NavRow | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newHref, setNewHref] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      const next = (json.rows ?? []) as NavRow[];
      setRows(next);
      setDrafts(
        Object.fromEntries(next.map((r) => [r.id, { label: r.label, href: r.href }])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Whether the database has migration 033. Detected from the row shape rather
   * than probed, because the GET already returns every column: if no row
   * carries `can_toggle`, the column is not there and the Pinned control stays
   * hidden instead of writing a field that would be rejected.
   */
  const supportsPinning = useMemo(
    () => rows.some((r) => Object.prototype.hasOwnProperty.call(r, 'can_toggle')),
    [rows],
  );

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      markBusy(id, true);
      setError(null);
      try {
        const res = await fetch(API, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...body }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Save failed');
        const row = json.row as NavRow | undefined;
        if (row) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...row } : r)));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
        return false;
      } finally {
        markBusy(id, false);
      }
    },
    [],
  );

  const isDirty = (row: NavRow) => {
    const d = drafts[row.id];
    if (!d) return false;
    return d.label !== row.label || d.href !== row.href;
  };

  const setDraft = (id: string, key: keyof Draft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { label: '', href: '' }), [key]: value },
    }));

  const saveRow = async (row: NavRow) => {
    const d = drafts[row.id];
    if (!d) return;
    if (!d.label.trim() || !d.href.trim()) {
      setError('Label and link are both required.');
      return;
    }
    const ok = await patch(row.id, { label: d.label.trim(), href: d.href.trim() });
    if (!ok) return;
    setSavedId(row.id);
    window.setTimeout(() => setSavedId((cur) => (cur === row.id ? null : cur)), 2000);
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    const ao = a.display_order ?? index;
    const bo = b.display_order ?? target;
    const next = [...rows];
    next[index] = b;
    next[target] = a;
    setRows(next);
    await Promise.all([
      patch(a.id, { display_order: bo }),
      patch(b.id, { display_order: ao }),
    ]);
    load();
  };

  const create = async () => {
    const label = newLabel.trim();
    const href = newHref.trim();
    if (!label || !href) {
      setError('Give the new item both a label and a link.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          href,
          // Append. Nav order is meaningful, and a new link belongs at the end
          // until someone moves it.
          display_order: rows.length,
          visible: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not add the item');
      setNewLabel('');
      setNewHref('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the item');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    setPendingDelete(null);
    if (!row) return;
    markBusy(row.id, true);
    setError(null);
    try {
      const res = await fetch(`${API}?id=${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      markBusy(row.id, false);
    }
  };

  return (
    <div>
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
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                <th style={{ ...thStyle, width: 66 }}>Order</th>
                <th style={{ ...thStyle, width: '32%' }}>Label</th>
                <th style={thStyle}>Link</th>
                <th style={{ ...thStyle, width: 82 }}>Visible</th>
                {supportsPinning && <th style={{ ...thStyle, width: 82 }}>Pinned</th>}
                <th style={{ ...thStyle, width: 170 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={supportsPinning ? 6 : 5}
                    style={{
                      ...tdStyle,
                      padding: 34,
                      textAlign: 'center',
                      color: ADMIN_COLORS.textMuted,
                    }}
                  >
                    No navigation items yet. Add the first navbar link below.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const busy = busyIds.has(row.id);
                const dirty = isDirty(row);
                const pinned = row.can_toggle === false;
                const draft = drafts[row.id] ?? { label: row.label, href: row.href };
                return (
                  <tr key={row.id} style={dirty ? { background: '#FFFDF5' } : undefined}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          aria-label={`Move ${row.label} up`}
                          disabled={i === 0 || busy}
                          onClick={() => reorder(i, -1)}
                          style={{ ...miniBtn, opacity: i === 0 ? 0.3 : 1 }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${row.label} down`}
                          disabled={i === rows.length - 1 || busy}
                          onClick={() => reorder(i, 1)}
                          style={{ ...miniBtn, opacity: i === rows.length - 1 ? 0.3 : 1 }}
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        aria-label={`Menu label for ${row.label}`}
                        value={draft.label}
                        placeholder="Services"
                        onChange={(e) => setDraft(row.id, 'label', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRow(row);
                        }}
                        style={adminInput}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        aria-label={`Link target for ${row.label}`}
                        value={draft.href}
                        placeholder="/services"
                        onChange={(e) => setDraft(row.id, 'href', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRow(row);
                        }}
                        style={adminInput}
                      />
                    </td>

                    <td style={tdStyle}>
                      <ToggleSwitch
                        label={`Show ${row.label} in the navbar`}
                        checked={row.visible !== false}
                        busy={busy}
                        disabled={pinned}
                        title={
                          pinned
                            ? 'Pinned items always show in the navbar. Unpin it to hide it.'
                            : undefined
                        }
                        onChange={(next) => patch(row.id, { visible: next })}
                      />
                    </td>

                    {supportsPinning && (
                      <td style={tdStyle}>
                        <ToggleSwitch
                          label={`Pin ${row.label} in the navbar`}
                          checked={pinned}
                          busy={busy}
                          title="Pinned items cannot be hidden or deleted"
                          onChange={(next) => patch(row.id, { can_toggle: !next })}
                        />
                      </td>
                    )}

                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          justifyContent: 'flex-end',
                        }}
                      >
                        {savedId === row.id && !dirty && (
                          <span style={{ ...adminBadge('success'), fontSize: 10.5 }}>Saved</span>
                        )}
                        <SaveButton
                          onClick={() => saveRow(row)}
                          saving={busy && dirty}
                          disabled={!dirty}
                          style={{ padding: '6px 14px', fontSize: 12 }}
                        >
                          Save
                        </SaveButton>
                        {pinned ? (
                          <span
                            title="Pinned items cannot be deleted"
                            aria-label="Pinned, cannot be deleted"
                            style={{ ...miniBtn, cursor: 'default', color: ADMIN_COLORS.textMicro }}
                          >
                            <Lock size={13} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Delete ${row.label}`}
                            disabled={busy}
                            onClick={() => setPendingDelete(row)}
                            style={{ ...miniBtn, color: ADMIN_COLORS.danger }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* New item, at the bottom of the list rather than behind a
                  modal: adding a nav link is two fields, and seeing it land at
                  the end of the existing order is the useful part. */}
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <span style={{ ...miniBtn, cursor: 'default', color: ADMIN_COLORS.textMicro }}>
                    <Plus size={13} />
                  </span>
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <input
                    type="text"
                    aria-label="New menu label"
                    value={newLabel}
                    placeholder="New label"
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') create();
                    }}
                    style={adminInput}
                  />
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <input
                    type="text"
                    aria-label="New link target"
                    value={newHref}
                    placeholder="/case-studies"
                    onChange={(e) => setNewHref(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') create();
                    }}
                    style={adminInput}
                  />
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }} />
                {supportsPinning && <td style={{ ...tdStyle, borderBottom: 'none' }} />}
                <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={create}
                    disabled={creating || !newLabel.trim() || !newHref.trim()}
                    style={{
                      ...adminButtonGhost,
                      opacity: creating || !newLabel.trim() || !newHref.trim() ? 0.5 : 1,
                    }}
                  >
                    {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add item
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this navigation item?"
        body={
          pendingDelete
            ? `"${pendingDelete.label}" will disappear from the public navbar. The page itself is not deleted.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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
  padding: '10px 16px',
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
