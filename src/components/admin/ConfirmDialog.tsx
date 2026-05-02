'use client';

import { useEffect } from 'react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0F2540]/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-lg">
        <h3 className="text-base font-semibold text-[#0F1B2D]">{title}</h3>
        <p className="mt-2 text-sm text-neutral-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-[#0F1B2D] hover:bg-neutral-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium text-white transition ' +
              (destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1B3A5F] hover:bg-[#0F2540]')
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
