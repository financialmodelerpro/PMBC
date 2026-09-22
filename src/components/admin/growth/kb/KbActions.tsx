'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ADMIN_COLORS, adminButtonGhost } from '@/lib/admin/styles';

type Action = 'approve' | 'archive' | 'restore';

const COPY: Record<Action, { label: string; title: string; body: string; confirm: string; destructive?: boolean }> = {
  approve: {
    label: 'Approve',
    title: 'Approve this item?',
    body: 'The current wording becomes the approved copy that every AI agent reads, replacing any earlier approved copy. The approval is logged with your name and the time.',
    confirm: 'Approve',
  },
  archive: {
    label: 'Archive',
    title: 'Archive this item?',
    body: 'AI agents stop reading it straight away. It stays here, archived, and can be restored as a draft.',
    confirm: 'Archive',
    destructive: true,
  },
  restore: {
    label: 'Restore',
    title: 'Restore this item?',
    body: 'It returns as a draft. AI agents will not read it until it is approved again.',
    confirm: 'Restore',
  },
};

/**
 * Approve, archive or restore one Knowledge Base item, each behind a
 * confirmation. `onBeforeApprove` lets the editor save unsaved changes first,
 * so what is approved is exactly what is on screen.
 */
export function KbActions({
  id,
  actions,
  compact = false,
  onBeforeApprove,
  disabledReason,
}: {
  id: string;
  actions: Action[];
  compact?: boolean;
  onBeforeApprove?: () => Promise<boolean>;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      if (action === 'approve' && onBeforeApprove && !(await onBeforeApprove())) return;
      const res = await fetch(`/api/admin/growth/kb/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `${COPY[action].label} failed`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const button = compact ? { ...adminButtonGhost, padding: '5px 10px', fontSize: 12 } : adminButtonGhost;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: compact ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setPending(a)}
            disabled={busy || (a === 'approve' && Boolean(disabledReason))}
            title={a === 'approve' && disabledReason ? disabledReason : undefined}
            style={{ ...button, color: a === 'archive' ? ADMIN_COLORS.danger : button.color, opacity: busy || (a === 'approve' && disabledReason) ? 0.55 : 1 }}
          >
            {busy && pending === null ? `${COPY[a].label}` : COPY[a].label}
          </button>
        ))}
      </div>
      {error && <span style={{ fontSize: 12, color: ADMIN_COLORS.danger, maxWidth: 320 }}>{error}</span>}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? COPY[pending].title : ''}
        body={pending ? COPY[pending].body : ''}
        confirmLabel={pending ? COPY[pending].confirm : 'Confirm'}
        destructive={pending ? COPY[pending].destructive : false}
        onConfirm={() => pending && run(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
