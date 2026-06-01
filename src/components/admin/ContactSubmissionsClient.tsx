'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Mail, RefreshCw, Inbox } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

export type SubmissionStatus = 'new' | 'read' | 'responded' | 'archived';

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  country: string | null;
  service_interest: string | null;
  message: string;
  source_page: string | null;
  status: SubmissionStatus;
  notes: string | null;
  created_at: string | null;
  read_at: string | null;
  responded_at: string | null;
};

const FILTERS: Array<{ key: 'all' | SubmissionStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'read', label: 'Read' },
  { key: 'responded', label: 'Responded' },
  { key: 'archived', label: 'Archived' },
];

const STATUS_OPTIONS: Array<{ value: SubmissionStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'responded', label: 'Responded' },
  { value: 'archived', label: 'Archived' },
];

function statusTone(status: SubmissionStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'new':
      return 'warning';
    case 'responded':
      return 'success';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function statusLabel(status: SubmissionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(iso: string | null, withTime = true): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function ContactSubmissionsClient({
  initialRows,
  loadError,
}: {
  initialRows: ContactSubmission[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState<ContactSubmission[]>(initialRows);
  const [filter, setFilter] = useState<'all' | SubmissionStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<SubmissionStatus>('new');
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, new: 0, read: 0, responded: 0, archived: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  function flash(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2600);
  }

  function applyRow(updated: ContactSubmission) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function patch(id: string, body: { status?: SubmissionStatus; notes?: string | null }) {
    const res = await fetch('/api/admin/contact-submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    const data = await res.json();
    return data.row as ContactSubmission;
  }

  async function selectSubmission(row: ContactSubmission) {
    setSelectedId(row.id);
    setDraftStatus(row.status);
    setDraftNotes(row.notes ?? '');
    // Auto-mark a brand-new submission as read on first open.
    if (row.status === 'new') {
      try {
        const updated = await patch(row.id, { status: 'read' });
        applyRow(updated);
        setDraftStatus(updated.status);
      } catch {
        // Non-fatal; leave it as new and let the admin save manually.
      }
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await patch(selected.id, {
        status: draftStatus,
        notes: draftNotes,
      });
      applyRow(updated);
      flash('ok', 'Saved.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    try {
      const res = await fetch('/api/admin/contact-submissions', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setRows((data.rows ?? []) as ContactSubmission[]);
      flash('ok', 'Refreshed.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Refresh failed.');
    }
  }

  const dirty =
    !!selected &&
    (draftStatus !== selected.status || draftNotes !== (selected.notes ?? ''));

  if (loadError) {
    return (
      <div
        style={{
          ...cardStyle,
          borderColor: ADMIN_COLORS.danger,
          color: ADMIN_COLORS.danger,
          fontSize: 13,
        }}
      >
        Could not load submissions: {loadError}
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  ...tabStyle,
                  background: active ? ADMIN_COLORS.primary : '#FFFFFF',
                  color: active ? '#FFFFFF' : ADMIN_COLORS.textBody,
                  borderColor: active ? ADMIN_COLORS.primary : ADMIN_COLORS.border,
                }}
              >
                {f.label}
                <span
                  style={{
                    marginLeft: 7,
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: 0.8,
                  }}
                >
                  {counts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={refresh} style={adminButtonGhost}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {toast && (
        <div
          style={{
            marginBottom: 14,
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: toast.kind === 'ok' ? ADMIN_COLORS.successBg : ADMIN_COLORS.dangerBg,
            color: toast.kind === 'ok' ? ADMIN_COLORS.success : ADMIN_COLORS.danger,
          }}
        >
          {toast.text}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          body="Enquiries from the public contact form will appear here as they arrive."
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          {/* List */}
          <div
            style={{
              flex: '1 1 320px',
              minWidth: 280,
              maxWidth: 440,
              ...cardStyle,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {visibleRows.length === 0 ? (
                <p style={{ margin: 0, padding: 20, fontSize: 13, color: ADMIN_COLORS.textMuted }}>
                  No {filter} submissions.
                </p>
              ) : (
                visibleRows.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => selectSubmission(row)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '14px 16px',
                        border: 'none',
                        borderBottom: `1px solid ${ADMIN_COLORS.border}`,
                        borderLeft: active
                          ? `3px solid ${ADMIN_COLORS.accent}`
                          : '3px solid transparent',
                        background: active ? ADMIN_COLORS.altBg : '#FFFFFF',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: row.status === 'new' ? 700 : 600,
                            color: ADMIN_COLORS.textHeading,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.name}
                        </span>
                        <span style={adminBadge(statusTone(row.status))}>
                          {statusLabel(row.status)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 12,
                          color: ADMIN_COLORS.textMuted,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row.email}
                      </p>
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontSize: 12,
                          color: ADMIN_COLORS.textBody,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.message}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
                        {formatDate(row.created_at)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail */}
          <div style={{ flex: '2 1 460px', minWidth: 300 }}>
            {selected ? (
              <div style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 800,
                        color: ADMIN_COLORS.textHeading,
                      }}
                    >
                      {selected.name}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>
                      Received {formatDate(selected.created_at)}
                    </p>
                  </div>
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(
                      'Re: your enquiry to PaceMakers Business Consultants',
                    )}`}
                    style={{ ...adminButtonGhost, textDecoration: 'none' }}
                  >
                    <Mail size={13} /> Reply by email
                  </a>
                </div>

                {/* Field grid */}
                <dl
                  style={{
                    margin: '20px 0 0',
                    display: 'grid',
                    gap: 14,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  }}
                >
                  <Field label="Email" value={selected.email} mailto />
                  <Field label="Company" value={selected.company} />
                  <Field label="Phone" value={selected.phone} />
                  <Field label="Country" value={selected.country} />
                  <Field label="Service interest" value={selected.service_interest} />
                  <Field label="Source page" value={selected.source_page} />
                </dl>

                {/* Message */}
                <div style={{ marginTop: 20 }}>
                  <p style={adminLabel}>Message</p>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: ADMIN_COLORS.textBody,
                      background: ADMIN_COLORS.altBg,
                      border: `1px solid ${ADMIN_COLORS.border}`,
                      borderRadius: 8,
                      padding: '14px 16px',
                    }}
                  >
                    {selected.message}
                  </div>
                </div>

                {/* Status + timeline */}
                <div
                  style={{
                    marginTop: 20,
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  }}
                >
                  <div>
                    <label style={adminLabel} htmlFor="submission-status">
                      Status
                    </label>
                    <select
                      id="submission-status"
                      value={draftStatus}
                      onChange={(e) => setDraftStatus(e.target.value as SubmissionStatus)}
                      style={adminInput}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                    <p style={{ margin: '0 0 4px' }}>
                      <strong style={{ color: ADMIN_COLORS.textBody }}>First read:</strong>{' '}
                      {formatDate(selected.read_at)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong style={{ color: ADMIN_COLORS.textBody }}>Responded:</strong>{' '}
                      {formatDate(selected.responded_at)}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginTop: 20 }}>
                  <label style={adminLabel} htmlFor="submission-notes">
                    Internal notes
                  </label>
                  <textarea
                    id="submission-notes"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Follow-up notes, visible only to admins."
                    style={adminTextarea}
                  />
                </div>

                <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving}
                    style={!dirty || saving ? adminButtonPrimaryDisabled : adminButtonPrimary}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  {dirty && !saving && (
                    <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                      Unsaved changes
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a submission"
                body="Choose an enquiry from the list to read it, change its status, and add notes."
                icon
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mailto,
}: {
  label: string;
  value: string | null;
  mailto?: boolean;
}) {
  const display = value && value.trim().length > 0 ? value : '-';
  return (
    <div>
      <dt style={adminLabel}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 14, color: ADMIN_COLORS.textHeading, wordBreak: 'break-word' }}>
        {mailto && value ? (
          <a href={`mailto:${value}`} style={{ color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
            {value}
          </a>
        ) : (
          display
        )}
      </dd>
    </div>
  );
}

function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: boolean;
}) {
  return (
    <div
      style={{
        ...cardStyle,
        textAlign: 'center',
        padding: '48px 24px',
        color: ADMIN_COLORS.textMuted,
      }}
    >
      {icon && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Inbox size={28} color={ADMIN_COLORS.textMicro} />
        </div>
      )}
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
        {title}
      </p>
      <p style={{ margin: '6px auto 0', fontSize: 13, maxWidth: 360 }}>{body}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: ADMIN_COLORS.cardBg,
  border: `1px solid ${ADMIN_COLORS.border}`,
  borderRadius: 12,
  padding: 24,
};

const tabStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
