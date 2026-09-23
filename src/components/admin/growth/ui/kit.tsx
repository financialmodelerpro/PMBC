'use client';

/**
 * Small shared pieces for the Growth admin forms (from Phase 2, 2026-09-23).
 * Inline styles from lib/admin/styles.ts, as every admin screen.
 */

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties, type ReactNode } from 'react';

import { ADMIN_COLORS, adminButtonGhost, adminButtonPrimary, adminButtonPrimaryDisabled, adminLabel } from '@/lib/admin/styles';

export function Field({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <span style={adminLabel}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{hint}</span>}
    </label>
  );
}

export const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, alignItems: 'end' };

export type Notice = { tone: 'ok' | 'error'; text: string } | null;

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.tone === 'error' ? 'alert' : 'status'} style={{ margin: '10px 0 0', fontSize: 13, color: notice.tone === 'error' ? ADMIN_COLORS.danger : ADMIN_COLORS.success }}>
      {notice.text}
    </p>
  );
}

/** Runs one request at a time, shows its outcome, and refreshes the server data on success. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  async function run(key: string, fn: () => Promise<string | void>, opts: { refresh?: boolean } = {}) {
    setBusy(key);
    setNotice(null);
    try {
      const text = await fn();
      if (text) setNotice({ tone: 'ok', text });
      if (opts.refresh !== false) router.refresh();
      return true;
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Failed' });
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, notice, setNotice, run };
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={disabled ? adminButtonPrimaryDisabled : adminButtonPrimary}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, danger }: { children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...adminButtonGhost, ...(danger ? { color: ADMIN_COLORS.danger } : {}), ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}>
      {children}
    </button>
  );
}

export function MockBadge() {
  return (
    <span title="Sample output from the mock AI provider, not written by Claude" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: ADMIN_COLORS.warningBg, color: ADMIN_COLORS.warning, fontSize: 11, fontWeight: 700 }}>
      Mock
    </span>
  );
}
