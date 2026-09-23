'use client';

import { useState } from 'react';

import { adminInput } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

/** Rescore now, set a manual score with a required reason, or clear it. */
export function ScoreControls({ companyId, overridden, available }: { companyId: string; overridden: boolean; available: boolean }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState('');
  const [reason, setReason] = useState('');
  const { busy, notice, run } = useAction();
  const url = `/api/admin/growth/companies/${companyId}/score`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <GhostButton disabled={busy !== null} onClick={() => run('rescore', async () => (await sendJson('PUT', url), 'Rescored from the current rules and weights.'))}>
          Rescore now
        </GhostButton>
        {available && !overridden && <GhostButton onClick={() => setOpen(!open)}>Override score</GhostButton>}
        {available && overridden && (
          <GhostButton disabled={busy !== null} onClick={() => run('clear', async () => (await sendJson('POST', url, { action: 'clear' }), 'Override cleared; the rules score applies.'))}>
            Clear override
          </GhostButton>
        )}
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 8, marginTop: 10, alignItems: 'end' }}>
          <Field label="Score (0 to 100)">
            <input value={score} onChange={(e) => setScore(e.target.value)} style={adminInput} inputMode="numeric" />
          </Field>
          <Field label="Reason (required)" style={{ gridColumn: 'span 2' }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={adminInput} />
          </Field>
          <PrimaryButton
            disabled={busy !== null || reason.trim().length < 5 || !/^\d{1,3}$/.test(score) || Number(score) > 100}
            onClick={() =>
              run('set', async () => {
                await sendJson('POST', url, { action: 'set', score: Number(score), reason });
                setOpen(false);
                return 'Manual score set.';
              })
            }
          >
            Set score
          </PrimaryButton>
        </div>
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}
