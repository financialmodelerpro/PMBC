'use client';

import { useEffect } from 'react';

import { SECTION_TYPES } from '@/lib/cms/sectionTypes';

export function SectionPickerDialog({
  open,
  onPick,
  onClose,
}: {
  open: boolean;
  onPick: (sectionType: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[#0F2540]/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-[#0F1B2D]">Add section</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Pick a section type. Editors marked Phase 6 still create rows but render as
            placeholders for now.
          </p>
        </div>
        <ul className="grid max-h-[60vh] grid-cols-1 gap-px overflow-y-auto bg-neutral-100 sm:grid-cols-2">
          {SECTION_TYPES.map((meta) => (
            <li key={meta.type}>
              <button
                type="button"
                onClick={() => onPick(meta.type)}
                className="flex h-full w-full flex-col items-start gap-1 bg-white p-4 text-left transition hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-neutral-500">
                    {meta.type}
                  </span>
                  {!meta.implemented && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Phase 6
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-[#0F1B2D]">{meta.label}</p>
                <p className="text-xs text-neutral-500">{meta.description}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-[#0F1B2D] hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
