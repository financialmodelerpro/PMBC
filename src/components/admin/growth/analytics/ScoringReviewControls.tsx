'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminInput, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type Factor = { factor: string; current: number; suggested: number; meanPositive: number; meanNegative: number; lift: number };
type Run = { suggestion: { ok: boolean; reason?: string; factors?: Factor[]; positives: number; negatives: number }; bands: { band: string; total: number; positive: number }[]; saved: string | null };

export function RunReview() {
  const [result, setResult] = useState<Run | null>(null);
  const { busy, notice, run } = useAction();
  const go = (kind: 'prospect' | 'lead') =>
    run(kind, async () => {
      const r = await sendJson<Run>('POST', '/api/admin/growth/scoring-review', { action: 'run', kind });
      setResult(r);
      return r.suggestion.ok ? (r.saved ? 'New weights suggested below and saved for your decision.' : 'Suggested below; apply 093_growth_intelligence.sql to save and approve it.') : r.suggestion.reason ?? 'No suggestion.';
    });
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <PrimaryButton disabled={busy !== null} onClick={() => go('prospect')}>
          Review the Prospect Score
        </PrimaryButton>
        <GhostButton disabled={busy !== null} onClick={() => go('lead')}>
          Review the Lead Score
        </GhostButton>
      </div>
      <NoticeLine notice={notice} />
      {result && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            {result.suggestion.positives} positive and {result.suggestion.negatives} negative outcomes.
          </p>
          {result.bands.length > 0 && (
            <p style={{ margin: '0 0 8px', fontSize: 13 }}>
              By band: {result.bands.map((b) => `${b.band} ${b.positive} of ${b.total} reached a meeting`).join('; ')}.
            </p>
          )}
          {result.suggestion.factors && <FactorTable factors={result.suggestion.factors} />}
        </div>
      )}
    </div>
  );
}

export function FactorTable({ factors }: { factors: Factor[] }) {
  const num = { ...adminTd, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={adminTable}>
        <thead style={adminThead}>
          <tr>
            <th style={adminTh}>Factor</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Share when won or met</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Share when lost or silent</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Weight now</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Suggested</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.factor}>
              <td style={adminTd}>{f.factor.replace(/_/g, ' ')}</td>
              <td style={num}>{f.meanPositive}</td>
              <td style={num}>{f.meanNegative}</td>
              <td style={num}>{f.current}</td>
              <td style={{ ...num, fontWeight: 700, color: f.suggested > f.current ? ADMIN_COLORS.success : f.suggested < f.current ? ADMIN_COLORS.danger : undefined }}>{f.suggested}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecideReview({ id }: { id: string }) {
  const [note, setNote] = useState('');
  const { busy, notice, run } = useAction();
  const decide = (decision: 'approve' | 'reject') => run(decision, async () => (await sendJson('POST', '/api/admin/growth/scoring-review', { action: 'decide', id, decision, note: note || null }), decision === 'approve' ? 'Approved: the new weights are in force and companies rescore as they change.' : 'Rejected: the weights are unchanged.'));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <PrimaryButton disabled={busy !== null} onClick={() => decide('approve')}>
          Approve new weights
        </PrimaryButton>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to reject)" style={{ ...adminInput, width: 260 }} />
        <GhostButton danger disabled={busy !== null || note.trim().length < 3} onClick={() => decide('reject')}>
          Reject
        </GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
