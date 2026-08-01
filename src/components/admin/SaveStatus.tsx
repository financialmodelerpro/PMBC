'use client';

import { Check, AlertCircle } from 'lucide-react';

import { ADMIN_COLORS } from '@/lib/admin/styles';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Inline save feedback shown beside a SaveButton.
 *
 * Parity Phase 2 (FMP CMS_REFERENCE.md section 7.3): "saved" is now a solid
 * green pill (#1A7A30, white text, checkmark) rather than green text on the
 * page background, so success reads at a glance from across the screen the way
 * it does in FMP. The error state keeps #DC2626, which already matched.
 */
export function SaveStatus({ state, message }: { state: SaveState; message?: string }) {
  if (state === 'idle') return null;

  if (state === 'saving') {
    return <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Saving…</span>;
  }

  const pill = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: '#FFFFFF',
  } as const;

  if (state === 'saved') {
    return (
      <span role="status" style={{ ...pill, background: ADMIN_COLORS.toastSuccessBg }}>
        <Check size={14} aria-hidden />
        Saved
      </span>
    );
  }

  return (
    <span role="alert" style={{ ...pill, background: ADMIN_COLORS.danger }}>
      <AlertCircle size={14} aria-hidden />
      {message ?? 'Save failed'}
    </span>
  );
}
