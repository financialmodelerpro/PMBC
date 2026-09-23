'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import type { FeedDecision } from '@/lib/growth/feed';
import { dateTime } from '@/lib/growth/format';

import { sendJson } from '../ui/client';
import { MockBadge, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type Run = { id: string; created_at: string; trigger: string; mode: string; status: string; found: number; saved: number; duplicates: number; discarded: number; is_test: boolean };

const TONE = { kept: 'success', duplicate: 'neutral', discarded: 'danger', over_limit: 'warning' } as const;

/** Run the daily feed by hand, see what it kept, skipped and discarded, and the last runs. */
export function FeedPanel({ runs, available, keywords, paused }: { runs: Run[]; available: boolean; keywords: number; paused: boolean }) {
  const [decisions, setDecisions] = useState<FeedDecision[] | null>(null);
  const [mock, setMock] = useState(false);
  const { busy, notice, run } = useAction();
  const go = () =>
    run('feed', async () => {
      const r = await sendJson<{ message: string; decisions: FeedDecision[]; mode: string; previewOnly?: boolean }>('POST', '/api/admin/growth/feed/run');
      setDecisions(r.decisions);
      setMock(r.mode === 'mock_preview');
      return r.message;
    });
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="feed">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 id="feed" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
            Daily signal feed
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            {available ? `Runs each morning at 09:00 Riyadh time${paused ? ' (paused)' : ''} with ${keywords} keywords switched on (Settings). While paused a run by hand is a preview and saves nothing. Keeps only signals with a real evidence link, skips duplicates and stops at the AI budget.` : 'Needs 088_growth_prospecting.sql applied first.'}
          </p>
        </div>
        <PrimaryButton onClick={go} disabled={busy !== null || !available}>
          {busy ? 'Searching' : 'Run the feed now'}
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
      {decisions && decisions.length > 0 && (
        <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mock && (
            <li>
              <MockBadge /> <span style={{ fontSize: 12, color: ADMIN_COLORS.warning }}>Sample output about made-up companies; nothing was saved.</span>
            </li>
          )}
          {decisions.map((d, i) => (
            <li key={`${d.evidence_url}-${i}`} style={{ fontSize: 13 }}>
              <span style={adminBadge(TONE[d.outcome])}>{d.outcome.replace('_', ' ')}</span> <strong>{d.company_name || 'Unnamed'}</strong>: {d.summary} {d.matched_keyword && <span style={{ color: ADMIN_COLORS.textMuted }}>[{d.matched_keyword}] </span>}<span style={{ color: ADMIN_COLORS.textMuted }}>({d.why})</span>
            </li>
          ))}
        </ul>
      )}
      {runs.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          Last runs:{' '}
          {runs.map((r) => (
            <span key={r.id} style={{ marginRight: 12 }}>
              {dateTime(r.created_at)} {r.trigger} {r.mode === 'mock_preview' ? '(mock preview)' : ''}: {r.status}, {r.saved} kept, {r.duplicates} duplicates, {r.discarded} discarded
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
