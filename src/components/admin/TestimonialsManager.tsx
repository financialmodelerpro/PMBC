'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';

import {
  CollectionEditorDrawer,
  type CollectionRow,
  type FieldDef,
} from '@/components/admin/CollectionManager';
import { ToggleSwitch } from '@/components/admin/ToggleSwitch';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonPrimary,
} from '@/lib/admin/styles';

const API = '/api/admin/testimonials';

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';

type Filter = 'all' | TestimonialStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function statusOf(row: CollectionRow): TestimonialStatus {
  const s = row.status;
  return s === 'approved' || s === 'rejected' ? s : 'pending';
}

function toneFor(status: TestimonialStatus): 'success' | 'danger' | 'warning' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The testimonials approval board (FMP CMS_REFERENCE.md section 2.8, parity 8).
 *
 * A moderation queue rather than a generic collection list, so it does not use
 * `CollectionManager`. Approving a quote is the common action and it should not
 * cost a drawer round-trip; the same goes for the two placement flags. The
 * drawer is still here for editing the wording, reused from CollectionManager
 * so there is one editor implementation, not two.
 *
 * Every mutation is a PATCH through the shared collection API, so each one is
 * session-gated and writes its own audit row with a before/after diff. The
 * `approved_at` stamp is set server side from the status transition (see the
 * route), never sent from here.
 */
export function TestimonialsManager({ fields }: { fields: FieldDef[] }) {
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows((json.rows ?? []) as CollectionRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) c[statusOf(r)] += 1;
    return c;
  }, [rows]);

  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => statusOf(r) === filter)),
    [rows, filter],
  );

  // A selection made under one filter would silently act on rows the admin can
  // no longer see, so switching tabs clears it.
  const changeFilter = (next: Filter) => {
    setFilter(next);
    setSelected(new Set());
  };

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** PATCH one row and fold the server's copy back into local state. */
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
        if (!res.ok) throw new Error(json.error || 'Update failed');
        const row = json.row as CollectionRow | undefined;
        if (row) {
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...row } : r)));
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed');
        return false;
      } finally {
        markBusy(id, false);
      }
    },
    [],
  );

  const setStatus = (id: string, status: TestimonialStatus) => patch(id, { status });

  const bulkSetStatus = async (status: TestimonialStatus) => {
    const ids = visibleRows.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    // Sequential on purpose. Each PATCH writes an audit row, and firing twenty
    // at once against one Supabase connection pool is how you get partial
    // failures that are hard to explain afterwards.
    for (const id of ids) {
      await patch(id, { status });
    }
    setBulkBusy(false);
    setSelected(new Set());
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    const ao = (a.display_order as number) ?? index;
    const bo = (b.display_order as number) ?? target;
    const next = [...rows];
    next[index] = b;
    next[target] = a;
    setRows(next);
    await Promise.all([patch(a.id, { display_order: bo }), patch(b.id, { display_order: ao })]);
    load();
  };

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const r of visibleRows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of visibleRows) next.add(r.id);
      return next;
    });
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedCount = visibleRows.filter((r) => selected.has(r.id)).length;

  return (
    <div>
      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          role="tablist"
          aria-label="Filter testimonials by status"
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            background: '#FFFFFF',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 10,
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeFilter(f.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: 7,
                  background: active ? ADMIN_COLORS.primary : 'transparent',
                  color: active ? '#FFFFFF' : ADMIN_COLORS.textBody,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {f.label}
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: active ? 'rgba(255,255,255,0.22)' : '#F3F4F6',
                    color: active ? '#FFFFFF' : ADMIN_COLORS.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          style={adminButtonPrimary}
          onClick={() => {
            setEditing({
              id: '',
              name: '',
              text: '',
              status: 'pending',
              testimonial_type: 'written',
              is_featured: false,
              show_on_landing: false,
              display_order: 0,
            } as CollectionRow);
            setIsNew(true);
          }}
        >
          <Plus size={15} /> New entry
        </button>
      </div>

      {/* Bulk action bar. Only appears with a selection, so it never competes
          with the tabs for attention when there is nothing to act on. */}
      {selectedCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
            padding: '10px 14px',
            background: '#FFFFFF',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderLeft: `3px solid ${ADMIN_COLORS.accent}`,
            borderRadius: 10,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: ADMIN_COLORS.textHeading }}>
            {selectedCount} selected
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkSetStatus('approved')}
            style={{ ...approveButton, opacity: bulkBusy ? 0.6 : 1 }}
          >
            {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Approve selected
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkSetStatus('rejected')}
            style={{ ...rejectButton, opacity: bulkBusy ? 0.6 : 1 }}
          >
            <X size={13} /> Reject selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={adminButtonGhost}
          >
            Clear
          </button>
        </div>
      )}

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
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div
            style={{
              padding: 44,
              textAlign: 'center',
              color: ADMIN_COLORS.textMuted,
              fontSize: 13,
            }}
          >
            {rows.length === 0
              ? 'No testimonials yet. Add the first client quote.'
              : `No ${filter} testimonials.`}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.altBg }}>
                <th style={{ ...thStyle, width: 40 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                {filter === 'all' && <th style={{ ...thStyle, width: 66 }}>Order</th>}
                <th style={thStyle}>Testimonial</th>
                <th style={{ ...thStyle, width: 120 }}>Status</th>
                <th style={{ ...thStyle, width: 84 }}>Featured</th>
                <th style={{ ...thStyle, width: 84 }}>Homepage</th>
                <th style={{ ...thStyle, width: 210 }} />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const status = statusOf(row);
                const busy = busyIds.has(row.id);
                // Reorder acts on the unfiltered list, so it needs the index
                // there, not the index within the current tab.
                const absoluteIndex = rows.findIndex((r) => r.id === row.id);
                return (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${String(row.name ?? 'testimonial')}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>

                    {filter === 'all' && (
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={absoluteIndex === 0 || busy}
                            onClick={() => reorder(absoluteIndex, -1)}
                            style={{ ...miniBtn, opacity: absoluteIndex === 0 ? 0.3 : 1 }}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={absoluteIndex === rows.length - 1 || busy}
                            onClick={() => reorder(absoluteIndex, 1)}
                            style={{
                              ...miniBtn,
                              opacity: absoluteIndex === rows.length - 1 ? 0.3 : 1,
                            }}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </td>
                    )}

                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing({ ...row });
                          setIsNew(false);
                        }}
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
                        {String(row.name ?? '') || 'Untitled'}
                      </button>
                      <div style={{ fontSize: 11.5, color: ADMIN_COLORS.textMuted, marginTop: 2 }}>
                        {[row.role, row.company].filter(Boolean).join(', ') || 'No attribution'}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: ADMIN_COLORS.textBody,
                          marginTop: 5,
                          maxWidth: 460,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {String(row.text ?? '')}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <span style={adminBadge(toneFor(status))}>{status}</span>
                      {status === 'approved' && formatDate(row.approved_at) && (
                        <div
                          style={{ fontSize: 10.5, color: ADMIN_COLORS.textMicro, marginTop: 4 }}
                        >
                          {formatDate(row.approved_at)}
                        </div>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <ToggleSwitch
                        label={`Feature ${String(row.name ?? 'testimonial')}`}
                        checked={Boolean(row.is_featured)}
                        busy={busy}
                        onChange={(next) => patch(row.id, { is_featured: next })}
                      />
                    </td>

                    <td style={tdStyle}>
                      <ToggleSwitch
                        label={`Show ${String(row.name ?? 'testimonial')} on the homepage`}
                        checked={Boolean(row.show_on_landing)}
                        busy={busy}
                        onChange={(next) => patch(row.id, { show_on_landing: next })}
                      />
                    </td>

                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: 6,
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        {status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setStatus(row.id, 'approved')}
                              style={{ ...approveButton, opacity: busy ? 0.6 : 1 }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setStatus(row.id, 'rejected')}
                              style={{ ...rejectButton, opacity: busy ? 0.6 : 1 }}
                            >
                              <X size={13} /> Reject
                            </button>
                          </>
                        )}
                        {status === 'approved' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStatus(row.id, 'pending')}
                            style={{ ...adminButtonGhost, padding: '5px 11px', opacity: busy ? 0.6 : 1 }}
                            title="Return this testimonial to the pending queue and clear its approval date"
                          >
                            <RotateCcw size={13} /> Revoke
                          </button>
                        )}
                        {status === 'rejected' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStatus(row.id, 'pending')}
                            style={{ ...adminButtonGhost, padding: '5px 11px', opacity: busy ? 0.6 : 1 }}
                            title="Return this testimonial to the pending queue for another look"
                          >
                            <RotateCcw size={13} /> Reconsider
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing({ ...row });
                            setIsNew(false);
                          }}
                          style={{ ...adminButtonGhost, padding: '5px 12px' }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <CollectionEditorDrawer
          apiBase={API}
          fields={fields}
          row={editing}
          isNew={isNew}
          title={isNew ? 'New testimonial' : String(editing.name ?? 'Testimonial')}
          onClose={() => {
            setEditing(null);
            setIsNew(false);
          }}
          onSaved={() => {
            setEditing(null);
            setIsNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const actionButtonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '5px 11px',
  border: 'none',
  borderRadius: 7,
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/**
 * Green approve, red reject. This is the one place the admin palette uses green
 * for something other than a Save button, and it is the same semantic: approve
 * commits the quote to the public site.
 */
const approveButton: React.CSSProperties = {
  ...actionButtonBase,
  background: ADMIN_COLORS.save,
};

const rejectButton: React.CSSProperties = {
  ...actionButtonBase,
  background: ADMIN_COLORS.danger,
};

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
