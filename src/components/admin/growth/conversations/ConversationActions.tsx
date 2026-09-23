'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminInput } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

export function CloseConversation({ id }: { id: string }) {
  const { busy, notice, run } = useAction();
  return (
    <div>
      <GhostButton disabled={busy !== null} onClick={() => run('close', async () => (await sendJson('PATCH', `/api/admin/growth/conversations/${id}`, { action: 'close' }), 'Closed.'))}>
        Close conversation
      </GhostButton>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function PreviewPagePicker({ value }: { value: string }) {
  const router = useRouter();
  const [page, setPage] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/admin/growth/conversations?page=${encodeURIComponent(page.startsWith('/') ? page : `/${page}`)}`);
      }}
      style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}
    >
      <label style={{ fontSize: 12 }}>
        As if on the page{' '}
        <input value={page} onChange={(e) => setPage(e.target.value)} style={{ ...adminInput, display: 'inline-block', width: 220 }} />
      </label>
      <GhostButton onClick={() => router.push(`/admin/growth/conversations?page=${encodeURIComponent(page)}`)}>Restart preview</GhostButton>
    </form>
  );
}

export function LinkToolLead({ id, disabled }: { id: string; disabled: boolean }) {
  const { busy, notice, run } = useAction();
  return (
    <div>
      <PrimaryButton disabled={busy !== null || disabled} onClick={() => run('link', async () => (await sendJson('POST', '/api/admin/growth/valuation-leads', { id }), 'Linked.'))}>
        Link to Growth
      </PrimaryButton>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function LinkAllToolLeads() {
  const { busy, notice, run } = useAction();
  return (
    <div>
      <GhostButton
        disabled={busy !== null}
        onClick={() =>
          run('all', async () => {
            const r = await sendJson<{ linked: number; skipped: number; errors: string[] }>('POST', '/api/admin/growth/valuation-leads', { all: true });
            return `Linked ${r.linked}; ${r.skipped} skipped (already linked, no consent, or suppressed)${r.errors.length ? `; ${r.errors.length} failed` : ''}.`;
          })
        }
      >
        Link every eligible lead
      </GhostButton>
      <NoticeLine notice={notice} />
    </div>
  );
}
