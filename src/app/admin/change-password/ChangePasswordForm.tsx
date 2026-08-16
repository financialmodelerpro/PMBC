'use client';

import { useState } from 'react';

import { SaveButton } from '@/components/admin/SaveButton';
import {
  ADMIN_COLORS,
  adminCard,
  adminInput,
  adminLabel,
  adminFieldHint,
} from '@/lib/admin/styles';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/auth/password';

/**
 * The three fields, and nothing else.
 *
 * The same `passwordProblem` the API enforces runs here too, so the reason a
 * password is refused is the same sentence in both places and the person typing
 * finds out before they submit. The client check is the courtesy; the server
 * check is the control, and neither is derived from the other by trust.
 *
 * Nothing here writes a password anywhere but the request body: no local
 * storage, no query string, no console.
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const localProblem =
    next.length === 0
      ? null
      : (passwordProblem(next) ??
        (confirm.length > 0 && next !== confirm ? 'The two new passwords do not match.' : null));

  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0 && !localProblem && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
          confirm_password: confirm,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not change the password.');
        return;
      }
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ ...adminCard, maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={adminInput}
          />
        </label>

        <label style={{ display: 'block' }}>
          <span style={adminLabel}>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            style={adminInput}
          />
          <p style={adminFieldHint}>
            At least {MIN_PASSWORD_LENGTH} characters. A phrase you can remember beats a
            short password you cannot, and there are no symbol rules to work around.
          </p>
        </label>

        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={adminInput}
          />
        </label>

        {localProblem && (
          <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.warning }}>{localProblem}</p>
        )}
        {error && (
          <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>
        )}
        {done && (
          <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.success }}>
            Password changed. Use the new one next time you sign in.
          </p>
        )}

        <div>
          <SaveButton type="submit" saving={saving} disabled={!canSubmit}>
            {saving ? 'Changing...' : 'Change password'}
          </SaveButton>
        </div>
      </div>
    </form>
  );
}
