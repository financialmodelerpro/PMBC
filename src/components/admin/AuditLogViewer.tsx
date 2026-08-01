'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

/**
 * Shared audit log table (parity Phase 7, FMP CMS_REFERENCE.md section 6).
 *
 * Filters by admin, action and date range, pages 100 rows at a time, and shows
 * a before/after JSON diff per row. Extracted as a component because FMP has
 * one and its own docs recommend the extraction; PMBC previously inlined the
 * table in the page.
 */

const PAGE_SIZE = 100;

type AdminRef = { name: string | null; email: string | null } | null;

type Entry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string | null;
  reason?: string | null;
  metadata?: unknown;
  before_value?: unknown;
  after_value?: unknown;
  admin_users?: AdminRef;
};

type Options = {
  admins: Array<{ id: string; name: string | null; email: string | null }>;
  actions: string[];
};

function actionTone(action: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (action === 'create' || action === 'upload') return 'success';
  if (action === 'delete') return 'danger';
  if (action === 'update') return 'warning';
  return 'neutral';
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function adminLabelFor(a: AdminRef): string {
  if (!a) return 'System';
  return a.name || a.email || 'System';
}

export function AuditLogViewer() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffAvailable, setDiffAvailable] = useState(true);

  const [options, setOptions] = useState<Options>({ admins: [], actions: [] });
  const [adminId, setAdminId] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [diffRow, setDiffRow] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', String(PAGE_SIZE));
      qs.set('offset', String(offset));
      if (adminId) qs.set('admin_id', adminId);
      for (const a of actions) qs.append('action', a);
      if (fromDate) qs.set('from_date', fromDate);
      if (toDate) qs.set('to_date', toDate);

      const res = await fetch(`/api/admin/audit-log?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load audit log');
      setEntries(json.entries ?? []);
      setTotal(json.total ?? 0);
      setDiffAvailable(json.diffColumnsAvailable !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [offset, adminId, actions, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/admin/audit-log', { method: 'POST' })
      .then((r) => r.json())
      .then((j) => setOptions({ admins: j.admins ?? [], actions: j.actions ?? [] }))
      .catch(() => setOptions({ admins: [], actions: [] }));
  }, []);

  // Any filter change invalidates the current page number, so reset to the
  // first page rather than leaving the reader on an offset that no longer
  // exists in the filtered set.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setOffset(0);
    setter(v);
  };

  const toggleAction = (a: string) => {
    setOffset(0);
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const clearFilters = () => {
    setOffset(0);
    setAdminId('');
    setActions([]);
    setFromDate('');
    setToDate('');
  };

  const hasFilters = Boolean(adminId || actions.length || fromDate || toDate);
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + entries.length, total);

  return (
    <>
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'flex-end',
        }}
      >
        <label style={{ minWidth: 190 }}>
          <span style={adminLabel}>Admin</span>
          <select
            value={adminId}
            onChange={(e) => withReset(setAdminId)(e.target.value)}
            style={adminInput}
          >
            <option value="">All admins</option>
            {options.admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email || a.id}
              </option>
            ))}
          </select>
        </label>

        <div style={{ minWidth: 220 }}>
          <span style={adminLabel}>Action</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {options.actions.length === 0 && (
              <span style={{ fontSize: 11.5, color: ADMIN_COLORS.textMicro }}>
                No actions recorded yet
              </span>
            )}
            {options.actions.map((a) => {
              const on = actions.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAction(a)}
                  aria-pressed={on}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: `1px solid ${on ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`,
                    background: on ? ADMIN_COLORS.primary : '#FFFFFF',
                    color: on ? '#FFFFFF' : ADMIN_COLORS.textBody,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        <label>
          <span style={adminLabel}>From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => withReset(setFromDate)(e.target.value)}
            style={{ ...adminInput, width: 160 }}
          />
        </label>
        <label>
          <span style={adminLabel}>To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => withReset(setToDate)(e.target.value)}
            style={{ ...adminInput, width: 160 }}
          />
        </label>

        {hasFilters && (
          <button type="button" onClick={clearFilters} style={adminButtonGhost}>
            Clear filters
          </button>
        )}

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: ADMIN_COLORS.textMuted,
            paddingBottom: 8,
          }}
        >
          {loading
            ? 'Loading'
            : total === 0
              ? 'No entries'
              : `Showing ${first} to ${last} of ${total}`}
        </span>
      </div>

      {!diffAvailable && (
        <div
          style={{
            background: ADMIN_COLORS.warningBg,
            border: '1px solid #FBBF24',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: ADMIN_COLORS.warning,
            marginBottom: 14,
          }}
        >
          Migration 032 has not been applied, so <code>before_value</code>,{' '}
          <code>after_value</code> and <code>reason</code> do not exist yet. Entries are
          listed without diffs. Run{' '}
          <code>supabase/migrations/032_audit_log_diff_columns.sql</code> in the Supabase
          SQL editor to enable them.
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
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 44, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: 44,
              textAlign: 'center',
              color: ADMIN_COLORS.textMuted,
              fontSize: 13,
            }}
          >
            {hasFilters ? 'No entries match filters' : 'No activity recorded yet.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: ADMIN_COLORS.altBg }}>
                  <th style={th}>When</th>
                  <th style={th}>Admin</th>
                  <th style={th}>Action</th>
                  <th style={th}>Entity</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Reason</th>
                  <th style={{ ...th, width: 80, textAlign: 'right' }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((r) => {
                  const hasDiff =
                    (r.before_value != null && r.before_value !== undefined) ||
                    (r.after_value != null && r.after_value !== undefined);
                  return (
                    <tr key={r.id}>
                      <td style={{ ...td, color: ADMIN_COLORS.textMuted, whiteSpace: 'nowrap' }}>
                        {fmt(r.created_at)}
                      </td>
                      <td style={td}>{adminLabelFor(r.admin_users ?? null)}</td>
                      <td style={td}>
                        <span style={adminBadge(actionTone(r.action))}>{r.action}</span>
                      </td>
                      <td style={td}>{r.entity_type}</td>
                      <td
                        style={{
                          ...td,
                          color: ADMIN_COLORS.textMuted,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 12,
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.entity_id || ''}
                      </td>
                      <td style={{ ...td, color: ADMIN_COLORS.textMuted }}>
                        {r.reason || ''}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setDiffRow(r)}
                            style={{
                              ...adminButtonGhost,
                              padding: '4px 10px',
                              fontSize: 11,
                            }}
                          >
                            View
                          </button>
                        ) : (
                          <span
                            title="No before/after recorded for this entry"
                            style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}
                          >
                            none
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 14,
        }}
      >
        <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          {total > 0 && `Page ${Math.floor(offset / PAGE_SIZE) + 1} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            style={{
              ...adminButtonGhost,
              opacity: offset === 0 || loading ? 0.45 : 1,
              cursor: offset === 0 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={13} /> Previous
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
            style={{
              ...adminButtonGhost,
              opacity: offset + PAGE_SIZE >= total || loading ? 0.45 : 1,
              cursor: offset + PAGE_SIZE >= total || loading ? 'not-allowed' : 'pointer',
            }}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {diffRow && <DiffDialog entry={diffRow} onClose={() => setDiffRow(null)} />}
    </>
  );
}

function DiffDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const pretty = (v: unknown): string => {
    if (v === null || v === undefined) return '(none)';
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Audit entry diff"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(15,37,64,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          marginTop: 32,
          background: '#FFFFFF',
          borderRadius: 12,
          border: `1px solid ${ADMIN_COLORS.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: ADMIN_COLORS.textMuted,
              }}
            >
              {fmt(entry.created_at)} by {adminLabelFor(entry.admin_users ?? null)}
            </p>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: 14,
                fontWeight: 800,
                color: ADMIN_COLORS.textHeading,
              }}
            >
              {entry.action} on {entry.entity_type}
              {entry.entity_id ? ` (${entry.entity_id})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              width: 30,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: ADMIN_COLORS.textMuted,
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {entry.reason && (
          <p
            style={{
              margin: 0,
              padding: '10px 18px',
              background: ADMIN_COLORS.warningBg,
              color: ADMIN_COLORS.warning,
              fontSize: 12.5,
            }}
          >
            Reason: {entry.reason}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            background: ADMIN_COLORS.border,
          }}
        >
          <DiffPane title="Before" body={pretty(entry.before_value)} />
          <DiffPane title="After" body={pretty(entry.after_value)} />
        </div>
      </div>
    </div>
  );
}

function DiffPane({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: '#FFFFFF' }}>
      <p
        style={{
          margin: 0,
          padding: '8px 14px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
          borderBottom: `1px solid ${ADMIN_COLORS.border}`,
        }}
      >
        {title}
      </p>
      <pre
        style={{
          margin: 0,
          padding: 14,
          maxHeight: '60vh',
          overflow: 'auto',
          background: '#0F172A',
          color: '#F1F5F9',
          fontSize: 11.5,
          lineHeight: 1.55,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body}
      </pre>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textMuted,
  textAlign: 'left',
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 13,
  color: ADMIN_COLORS.textBody,
  borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`,
};
