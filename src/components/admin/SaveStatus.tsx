'use client';

import { Check, AlertCircle } from 'lucide-react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatus({ state, message }: { state: SaveState; message?: string }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return <span className="text-xs text-neutral-500">Saving…</span>;
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#1B6B3F]">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="h-3.5 w-3.5" />
      {message ?? 'Save failed'}
    </span>
  );
}
