'use client';

import { useEffect } from 'react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonPrimary,
  adminButtonDanger,
} from '@/lib/admin/styles';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,37,64,0.5)',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          padding: 22,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          margin: 16,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13,
            color: ADMIN_COLORS.textBody,
          }}
        >
          {body}
        </p>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" onClick={onCancel} style={adminButtonGhost}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={destructive ? adminButtonDanger : adminButtonPrimary}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
