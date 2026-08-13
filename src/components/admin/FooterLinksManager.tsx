'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SaveButton } from '@/components/admin/SaveButton';
import { ToggleSwitch } from '@/components/admin/ToggleSwitch';
import {
  FOOTER_LINK_COLUMNS,
  type FooterLink,
  type FooterLinkColumn,
} from '@/lib/cms/footerLinks';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminInput,
} from '@/lib/admin/styles';

const API = '/api/admin/footer-links';

type Draft = { label: string; href: string };

/**
 * Footer Links, the footer's counterpart to Pages and Nav.
 *
 * Same save model as SitePagesManager, deliberately, because it is the same
 * kind of work and a second set of rules for a near-identical table would be a
 * trap:
 *   - label and href    pending until that row's Save
 *   - visible, column   save immediately
 *   - reorder           saves immediately
 *   - create and delete save immediately
 *
 * The one structural difference is underneath: this list is a single JSON value
 * in cms_content rather than a table of rows, so every write sends the whole
 * list. Dirty state is still tracked per row, so one row's Save cannot flush
 * another row's half-typed edit; the value that goes to the server is the saved
 * state of every other row plus the edited one.
 */
export function FooterLinksManager() {
  const [rows, setRows] = useState<FooterLink[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FooterLink | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newHref, setNewHref] = useState('');
  const [newColumn, setNewColumn] = useState<FooterLinkColumn>('firm');
  const [creating, setCreating] = useState(false);

  const adopt = useCallback((next: FooterLink[]) => {
    setRows(next);
    setDrafts(
      Object.fromEntries(next.map((r) => [r.id, { label: r.label, href: r.href }])),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      adopt((json.links ?? []) as FooterLink[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Writes the whole list. `busyFor` is the row whose control should show the
   * write in flight, so a toggle on one row does not grey out the table.
   */
  const persist = useCallback(
    async (next: FooterLink[], busyFor: string): Promise<boolean> => {
      setBusyId(busyFor);
      setError(null);
      try {
        const res = await fetch(API, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Save failed');
        adopt((json.links ?? next) as FooterLink[]);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [adopt],
  );

  const isDirty = (row: FooterLink) => {
    const d = drafts[row.id];
    if (!d) return false;
    return d.label !== row.label || d.href !== row.href;
  };

  const setDraft = (id: string, key: keyof Draft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { label: '', href: '' }), [key]: value },
    }));

  const saveRow = async (row: FooterLink) => {
    const d = drafts[row.id];
    if (!d) return;
    if (!d.label.trim() || !d.href.trim()) {
      setError('Label and link are both required.');
      return;
    }
    const next = rows.map((r) =>
      r.id === row.id ? { ...r, label: d.label.trim(), href: d.href.trim() } : r,
    );
    if (!(await persist(next, row.id))) return;
    setSavedId(row.id);
    window.setTimeout(() => setSavedId((cur) => (cur === row.id ? null : cur)), 2000);
  };

  const patchRow = (row: FooterLink, patch: Partial<FooterLink>) =>
    persist(
      rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)),
      row.id,
    );

  const reorder = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    next[index] = rows[target];
    next[target] = rows[index];
    return persist(next, rows[index].id);
  };

  const create = async () => {
    const label = newLabel.trim();
    const href = newHref.trim();
    if (!label || !href) {
      setError('Give the new link both a label and a target.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `link-${rows.length}-${href}`;
      const next: FooterLink[] = [
        ...rows,
        { id, label, href, column: newColumn, visible: true },
      ];
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not add the link');
      adopt((json.links ?? next) as FooterLink[]);
      setNewLabel('');
      setNewHref('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the link');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    setPendingDelete(null);
    if (!row) return;
    await persist(
      rows.filter((r) => r.id !== row.id),
      row.id,
    );
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                <th style={{ ...thStyle, width: 66 }}>Order</th>
                <th style={{ ...thStyle, width: '28%' }}>Label</th>
                <th style={thStyle}>Link</th>
                <th style={{ ...thStyle, width: 130 }}>Column</th>
                <th style={{ ...thStyle, width: 82 }}>Visible</th>
                <th style={{ ...thStyle, width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...tdStyle,
                      padding: 34,
                      textAlign: 'center',
                      color: ADMIN_COLORS.textMuted,
                    }}
                  >
                    No footer links yet. Add the first one below.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const busy = busyId === row.id;
                const dirty = isDirty(row);
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
                        aria-label={`Footer label for ${row.label}`}
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
                      <select
                        aria-label={`Footer column for ${row.label}`}
                        value={row.column}
                        disabled={busy}
                        onChange={(e) =>
                          patchRow(row, { column: e.target.value as FooterLinkColumn })
                        }
                        style={adminInput}
                      >
                        {FOOTER_LINK_COLUMNS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={tdStyle}>
                      <ToggleSwitch
                        label={`Show ${row.label} in the footer`}
                        checked={row.visible}
                        busy={busy}
                        onChange={(next) => patchRow(row, { visible: next })}
                      />
                    </td>

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
                        <button
                          type="button"
                          aria-label={`Delete ${row.label}`}
                          disabled={busy}
                          onClick={() => setPendingDelete(row)}
                          style={{ ...miniBtn, color: ADMIN_COLORS.danger }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* New link, at the bottom of the list rather than behind a modal,
                  matching Pages and Nav. */}
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <span style={{ ...miniBtn, cursor: 'default', color: ADMIN_COLORS.textMicro }}>
                    <Plus size={13} />
                  </span>
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <input
                    type="text"
                    aria-label="New footer label"
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
                    aria-label="New footer link target"
                    value={newHref}
                    placeholder="/case-studies"
                    onChange={(e) => setNewHref(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') create();
                    }}
                    style={adminInput}
                  />
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }}>
                  <select
                    aria-label="New footer link column"
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value as FooterLinkColumn)}
                    style={adminInput}
                  >
                    {FOOTER_LINK_COLUMNS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ ...tdStyle, borderBottom: 'none' }} />
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
                    Add link
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this footer link?"
        body={
          pendingDelete
            ? `"${pendingDelete.label}" will disappear from the footer. The page itself is not deleted. If you only want it out of sight for now, turn Visible off instead.`
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
