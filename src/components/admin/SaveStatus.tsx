'use client';

import { Check, AlertCircle } from 'lucide-react';

import { ADMIN_COLORS } from '@/lib/admin/styles';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatus({ state, message }: { state: SaveState; message?: string }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Saving…</span>
    );
  }
  if (state === 'saved') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: ADMIN_COLORS.success,
        }}
      >
        <Check size={14} />
        Saved
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        color: ADMIN_COLORS.danger,
      }}
    >
      <AlertCircle size={14} />
      {message ?? 'Save failed'}
    </span>
  );
}
