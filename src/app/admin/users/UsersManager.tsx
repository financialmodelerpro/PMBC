'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { SaveButton } from '@/components/admin/SaveButton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonIcon,
  adminCard,
  adminFieldHint,
  adminInput,
  adminLabel,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/auth/password';

type Row = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor';
  created_at: string | null;
  last_login_at: string | null;
};

/** What each role may do, in the words the console uses elsewhere. */
const ROLE_NOTE: Record<'admin' | 'editor', string> = {
  admin: 'Everything, including deleting, site settings, users and the audit log.',
  editor:
    'Creates and edits content, and can hide anything. Cannot delete, and cannot reach Site Settings, Header Settings, Footer Links, Users or the Audit Log.',
};

function fmt(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = (await res.json()) as { rows?: Row[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not load users.');
        return;
      }
      setRows(json.rows ?? []);
      setError(null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(row: Row, role: 'admin' | 'editor') {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, role }),
      });
      const json = (await res.json()) as { row?: Row; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not change the role.');
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role } : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Row) {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not remove the user.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && (
        <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>
      )}

      <div style={adminCard}>
        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              <th style={adminTh}>Name</th>
              <th style={adminTh}>Email</th>
              <th style={adminTh}>Role</th>
              <th style={adminTh}>Last signed in</th>
              <th style={{ ...adminTh, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={adminTd} colSpan={5}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td style={adminTd} colSpan={5}>
                  No users yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isSelf = r.id === currentUserId;
              return (
                <tr key={r.id}>
                  <td style={{ ...adminTd, color: ADMIN_COLORS.textHeading, fontWeight: 600 }}>
                    {r.name}
                    {isSelf && (
                      <span style={{ ...adminBadge('neutral'), marginLeft: 8 }}>you</span>
                    )}
                  </td>
                  <td style={adminTd}>{r.email}</td>
                  <td style={adminTd}>
                    <select
                      value={r.role}
                      disabled={busyId === r.id || isSelf}
                      onChange={(e) => setRole(r, e.target.value as 'admin' | 'editor')}
                      style={{ ...adminInput, width: 'auto', padding: '6px 10px' }}
                      title={
                        isSelf
                          ? 'You cannot change your own role. Ask another admin.'
                          : ROLE_NOTE[r.role]
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                    </select>
                  </td>
                  <td style={adminTd}>{fmt(r.last_login_at)}</td>
                  <td style={adminTd}>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(r)}
                      disabled={busyId === r.id || isSelf}
                      style={{
                        ...adminButtonIcon,
                        opacity: isSelf ? 0.4 : 1,
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                      }}
                      title={isSelf ? 'You cannot remove your own account.' : `Remove ${r.name}`}
                      aria-label={`Remove ${r.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{ ...adminFieldHint, marginTop: 14 }}>
          <strong>Editor:</strong> {ROLE_NOTE.editor}
        </p>
      </div>

      <CreateUser onCreated={(row) => setRows((prev) => [...prev, row])} setError={setError} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Remove ${pendingDelete.name}?` : 'Remove user?'}
        body="They will no longer be able to sign in. Their entries in the audit log are kept."
        confirmLabel="Remove"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function CreateUser({
  onCreated,
  setError,
}: {
  onCreated: (row: Row) => void;
  setError: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const problem = password.length === 0 ? null : passwordProblem(password);
  const canSubmit =
    email.trim().length > 0 && name.trim().length > 0 && password.length > 0 && !problem && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role, password }),
      });
      const json = (await res.json()) as { row?: Row; error?: string };
      if (!res.ok || !json.row) {
        setError(json.error ?? 'Could not create the user.');
        return;
      }
      onCreated(json.row);
      setEmail('');
      setName('');
      setPassword('');
      setRole('editor');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} style={adminButtonGhost}>
          <Plus size={13} /> Add a user
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ ...adminCard, maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={adminInput} />
        </label>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Email</span>
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={adminInput}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'editor')}
            style={adminInput}
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <p style={adminFieldHint}>{ROLE_NOTE[role]}</p>
        </label>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Initial password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={adminInput}
          />
          <p style={adminFieldHint}>
            At least {MIN_PASSWORD_LENGTH} characters. Send it to them by a route other
            than email if you can, and ask them to change it under Change Password.
          </p>
        </label>
        {problem && (
          <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.warning }}>{problem}</p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <SaveButton type="submit" saving={saving} disabled={!canSubmit}>
            {saving ? 'Creating...' : 'Create user'}
          </SaveButton>
          <button type="button" onClick={() => setOpen(false)} style={adminButtonGhost}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
