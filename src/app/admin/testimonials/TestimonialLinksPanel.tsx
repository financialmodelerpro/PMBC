'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';

import { SaveButton } from '@/components/admin/SaveButton';
import { ToggleSwitch } from '@/components/admin/ToggleSwitch';
import { useCanDelete } from '@/components/admin/AdminRoleProvider';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonIcon,
  adminFieldHint,
  adminInput,
  adminLabel,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';

type Row = {
  id: string;
  token: string;
  label: string;
  note: string | null;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
};

function fmt(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The page the link points at is the operator's choice, because the form is a
 * section that can sit anywhere. This is the sensible default to offer, and the
 * field is editable so a link can point at whichever page carries the form.
 */
const DEFAULT_TARGET = '/contact';

export function TestimonialLinksPanel() {
  const canDelete = useCanDelete();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [copied, setCopied] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/testimonial-links');
      const json = (await res.json()) as {
        rows?: Row[];
        schemaReady?: boolean;
        error?: string;
      };
      setSchemaReady(json.schemaReady !== false);
      if (json.error) setError(json.error);
      else setError(null);
      setRows(json.rows ?? []);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function urlFor(row: Row): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const path = target.startsWith('/') ? target : `/${target}`;
    return `${origin}${path}?t=${row.token}`;
  }

  async function copy(row: Row) {
    try {
      await navigator.clipboard.writeText(urlFor(row));
      setCopied(row.id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  async function setActive(row: Row, active: boolean) {
    setBusyId(row.id);
    try {
      const res = await fetch('/api/admin/testimonial-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, active }),
      });
      const json = (await res.json()) as { row?: Row; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not update the link.');
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active } : r)));
      setError(null);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Row) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/testimonial-links?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not delete the link.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setError(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: schemaReady ? ADMIN_COLORS.danger : ADMIN_COLORS.warning,
          }}
        >
          {error}
        </p>
      )}

      <div>
        <label style={{ display: 'block', maxWidth: 420, marginBottom: 18 }}>
          <span style={adminLabel}>Link points at</span>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={adminInput}
          />
          <p style={adminFieldHint}>
            Whichever page carries the Testimonial form section. Changing this
            changes the links copied below; it is not stored, because the same link
            works on any page carrying the form.
          </p>
        </label>

        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              <th style={adminTh}>Sent to</th>
              <th style={adminTh}>Used</th>
              <th style={adminTh}>Last used</th>
              <th style={adminTh}>Active</th>
              <th style={{ ...adminTh, width: 110 }}>Link</th>
              <th style={{ ...adminTh, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={adminTd} colSpan={6}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td style={adminTd} colSpan={6}>
                  {schemaReady
                    ? 'No links yet. Create one to send a client.'
                    : 'Unavailable until migration 072 is applied.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...adminTd, color: ADMIN_COLORS.textHeading, fontWeight: 600 }}>
                  {r.label}
                  {r.note && (
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 400,
                        fontSize: 12,
                        color: ADMIN_COLORS.textMuted,
                      }}
                    >
                      {r.note}
                    </span>
                  )}
                </td>
                <td style={adminTd}>
                  {r.use_count > 0 ? (
                    <span style={adminBadge('success')}>{r.use_count}</span>
                  ) : (
                    <span style={adminBadge('neutral')}>0</span>
                  )}
                </td>
                <td style={adminTd}>{fmt(r.last_used_at)}</td>
                <td style={adminTd}>
                  <ToggleSwitch
                    checked={r.active}
                    busy={busyId === r.id}
                    onChange={(next) => setActive(r, next)}
                    label={`${r.active ? 'Revoke' : 'Restore'} the link for ${r.label}`}
                    title={
                      r.active
                        ? 'Live. Turn off to revoke it.'
                        : 'Revoked. Anyone opening it is told to get in touch.'
                    }
                  />
                </td>
                <td style={adminTd}>
                  <button type="button" onClick={() => copy(r)} style={adminButtonGhost}>
                    <Copy size={13} /> {copied === r.id ? 'Copied' : 'Copy'}
                  </button>
                </td>
                <td style={adminTd}>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busyId === r.id || r.use_count > 0}
                      style={{
                        ...adminButtonIcon,
                        opacity: r.use_count > 0 ? 0.4 : 1,
                        cursor: r.use_count > 0 ? 'not-allowed' : 'pointer',
                      }}
                      title={
                        r.use_count > 0
                          ? 'This link has been used. Revoke it instead, so its testimonials keep their source.'
                          : `Delete ${r.label}`
                      }
                      aria-label={`Delete ${r.label}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {schemaReady && <CreateLink onCreated={(row) => setRows((p) => [row, ...p])} setError={setError} />}
    </div>
  );
}

function CreateLink({
  onCreated,
  setError,
}: {
  onCreated: (row: Row) => void;
  setError: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim().length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/testimonial-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), note: note.trim() }),
      });
      const json = (await res.json()) as { row?: Row; error?: string };
      if (!res.ok || !json.row) {
        setError(json.error ?? 'Could not create the link.');
        return;
      }
      onCreated(json.row);
      setLabel('');
      setNote('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} style={adminButtonGhost}>
          <Plus size={13} /> Create a link
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Who is this for</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Leslie Merricroft, Al-Mashrea"
            style={adminInput}
          />
          <p style={adminFieldHint}>
            The only way to tell two links apart later, so name the person or firm
            rather than the occasion.
          </p>
        </label>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Note</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional. Which mandate, when you sent it."
            style={adminInput}
          />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <SaveButton type="submit" saving={saving} disabled={label.trim().length === 0 || saving}>
            {saving ? 'Creating...' : 'Create link'}
          </SaveButton>
          <button type="button" onClick={() => setOpen(false)} style={adminButtonGhost}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
