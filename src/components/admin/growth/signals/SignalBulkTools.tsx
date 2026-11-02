'use client';

import { useEffect, useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard, adminInput } from '@/lib/admin/styles';
import type { CleanupProposal } from '@/lib/growth/inboxCleanup';
import { BULK_DISMISS_MAX } from '@/lib/growth/signalsModel';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type BulkResult = { dismissed: number; skipped: number; failed: { id: string; error: string }[] };

const resultLine = (r: BulkResult) =>
  `${r.dismissed} dismissed.${r.skipped ? ` ${r.skipped} skipped (no longer new).` : ''}${r.failed.length ? ` ${r.failed.length} failed: ${r.failed[0].error}` : ''}`;

/**
 * Re-applies today's feed rules to every new signal and lists what they would
 * turn away, each with its reason, all ticked. Nothing is dismissed until the
 * ticked list is confirmed.
 */
export function InboxCleanup({ proposals, newCount }: { proposals: CleanupProposal[]; newCount: number }) {
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(proposals.map((p) => p.id)));
  const [confirming, setConfirming] = useState(false);
  const { busy, notice, run } = useAction();
  if (!proposals.length) return null;
  const chosen = proposals.filter((p) => ticked.has(p.id)).slice(0, BULK_DISMISS_MAX);
  const toggle = (id: string) =>
    setTicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const go = () =>
    run('cleanup', async () => {
      const r = await sendJson<BulkResult>('POST', '/api/admin/growth/signals/bulk', { items: chosen.map((p) => ({ id: p.id, reason: p.reason })) });
      setConfirming(false);
      return resultLine(r);
    });
  const notProspect = proposals.filter((p) => p.kind === 'not_a_prospect').length;
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="inbox-cleanup" data-cleanup={proposals.length}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 id="inbox-cleanup" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
            Clean up the inbox
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            Today&apos;s filters would turn away {proposals.length} of the {newCount} new signals: {notProspect} not a prospect (regulators, exchanges, market news, office openings) and {proposals.length - notProspect} repeats of an event already in the inbox, where the better version is kept. Untick any to keep; each is dismissed with its reason and can be reopened.
          </p>
        </div>
        <GhostButton onClick={() => setOpen((o) => !o)}>{open ? 'Hide the list' : 'Review the list'}</GhostButton>
      </div>
      {open && (
        <>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proposals.map((p) => (
              <li key={p.id} style={{ fontSize: 13 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={ticked.has(p.id)} onChange={() => toggle(p.id)} data-cleanup-id={p.id} style={{ marginTop: 3 }} />
                  <span>
                    <span style={adminBadge(p.kind === 'duplicate' ? 'warning' : 'neutral')}>{p.kind === 'duplicate' ? 'repeat' : 'not a prospect'}</span> <strong>{p.company_name || 'Unnamed'}</strong> ({p.signal_date}): {p.summary}
                    <span style={{ display: 'block', fontSize: 12, color: ADMIN_COLORS.textMuted }}>{p.reason.replace(/^Inbox cleanup: /, '')}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {confirming ? (
              <>
                <PrimaryButton onClick={go} disabled={busy !== null || !chosen.length}>
                  {busy ? 'Dismissing' : `Confirm: dismiss ${chosen.length}`}
                </PrimaryButton>
                <GhostButton onClick={() => setConfirming(false)} disabled={busy !== null}>
                  Cancel
                </GhostButton>
              </>
            ) : (
              <PrimaryButton onClick={() => setConfirming(true)} disabled={!chosen.length}>
                {`Dismiss ${chosen.length} ticked`}
              </PrimaryButton>
            )}
          </div>
        </>
      )}
      <NoticeLine notice={notice} />
    </section>
  );
}

/** Dismiss the signals ticked in the list below with one reason. Reads the row checkboxes (`data-bulk-signal`). */
export function BulkDismissBar() {
  const [reason, setReason] = useState('');
  const [count, setCount] = useState(0);
  const { busy, notice, run } = useAction();
  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[data-bulk-signal]'));
  const recount = () => setCount(boxes().filter((b) => b.checked).length);
  const setAll = (on: boolean) => {
    boxes().forEach((b) => {
      b.checked = on;
    });
    recount();
  };
  useEffect(() => {
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLInputElement && e.target.dataset.bulkSignal) setCount(Array.from(document.querySelectorAll<HTMLInputElement>('input[data-bulk-signal]')).filter((b) => b.checked).length);
    };
    document.addEventListener('change', onChange);
    return () => document.removeEventListener('change', onChange);
  }, []);
  const go = () =>
    run('bulk', async () => {
      const ids = boxes()
        .filter((b) => b.checked)
        .map((b) => b.dataset.bulkSignal as string);
      if (!ids.length) throw new Error('Tick at least one signal in the list.');
      if (reason.trim().length < 3) throw new Error('Give a reason.');
      const r = await sendJson<BulkResult>('POST', '/api/admin/growth/signals/bulk', { items: ids.slice(0, BULK_DISMISS_MAX).map((id) => ({ id, reason: reason.trim() })) });
      setAll(false);
      setReason('');
      return resultLine(r);
    });
  return (
    <div style={{ ...adminCard, padding: 12, marginBottom: 12 }} data-bulk-bar>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="Dismiss the ticked signals with one reason" style={{ flex: '1 1 260px' }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={adminInput} placeholder="e.g. Not a fit: contractor or supplier" maxLength={500} />
        </Field>
        <GhostButton onClick={() => setAll(true)}>Tick all shown</GhostButton>
        <GhostButton onClick={() => setAll(false)}>Untick all</GhostButton>
        <PrimaryButton onClick={go} disabled={busy !== null}>
          {busy ? 'Dismissing' : `Dismiss ticked${count ? ` (${count})` : ''}`}
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
