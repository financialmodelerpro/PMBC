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

  // Step two. The change is parked server side against a one-time code until
  // this is filled in, so nothing has happened to the account yet.
  const [stage, setStage] = useState<'details' | 'verify'>('details');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');

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
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        stage?: string;
        sentTo?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not change the password.');
        return;
      }
      // Nothing has changed yet: the code has to come back first.
      setSentTo(json.sentTo ?? 'your email address');
      setStage('verify');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/change-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; restart?: boolean };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not confirm the code.');
        // A dead code sends the whole flow back to the start, rather than
        // leaving someone typing into a box that can no longer work.
        if (json.restart) {
          setStage('details');
          setCode('');
        }
        return;
      }
      setDone(true);
      setStage('details');
      setCurrent('');
      setNext('');
      setConfirm('');
      setCode('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  if (stage === 'verify') {
    return (
      <form onSubmit={verify} style={{ ...adminCard, maxWidth: 520 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 14, color: ADMIN_COLORS.textBody }}>
            A six-digit code has gone to <strong>{sentTo}</strong>. Enter it to
            finish. <strong>Your password has not changed yet</strong>, and the old
            one still works until you do.
          </p>

          <label style={{ display: 'block' }}>
            <span style={adminLabel}>Confirmation code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              style={{
                ...adminInput,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 20,
                letterSpacing: '0.3em',
              }}
            />
            <p style={adminFieldHint}>
              It expires in ten minutes and can be used once. If it does not arrive,
              start again to send a new one, which replaces this code.
            </p>
          </label>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <SaveButton type="submit" saving={saving} disabled={code.trim().length !== 6 || saving}>
              {saving ? 'Confirming...' : 'Confirm change'}
            </SaveButton>
            <button
              type="button"
              onClick={() => {
                setStage('details');
                setCode('');
                setError(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 6px',
                fontSize: 13,
                color: ADMIN_COLORS.textMuted,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Start again
            </button>
          </div>
        </div>
      </form>
    );
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

        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          A six-digit code goes to your own email address before the change takes
          effect, so knowing the current password is not enough on its own.
        </p>

        <div>
          <SaveButton type="submit" saving={saving} disabled={!canSubmit}>
            {saving ? 'Sending code...' : 'Continue'}
          </SaveButton>
        </div>
      </div>
    </form>
  );
}
