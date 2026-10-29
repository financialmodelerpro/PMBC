'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import type { FeedDecision } from '@/lib/growth/feed';
import { dateTime } from '@/lib/growth/format';

import { sendJson } from '../ui/client';
import { MockBadge, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type Run = { id: string; created_at: string; trigger: string; mode: string; status: string; found: number; saved: number; duplicates: number; discarded: number; is_test: boolean; detail?: Record<string, unknown> | null; cost_usd?: number | null };

/** How a past run read its answers and what it searched, from its stored detail (runs before 2026-10-29 have neither). */
function runDetail(r: Run): string {
  const d = r.detail ?? {};
  const parts: string[] = [];
  if (d.reason === 'budget' && typeof d.message === 'string') return ` (${d.message})`;
  if (typeof d.parse_summary === 'string') parts.push(d.parse_summary);
  if (typeof d.searches === 'number') parts.push(`${d.searches} searches`);
  if (typeof r.cost_usd === 'number') parts.push(`USD ${r.cost_usd.toFixed(2)}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/** The latest run's cost, or why it was skipped, for the line under the heading. */
function lastRunLine(r: Run | undefined): { text: string; skipped: boolean } | null {
  if (!r) return null;
  const d = r.detail ?? {};
  if (d.reason === 'budget' && typeof d.message === 'string') return { text: `Last run, ${dateTime(r.created_at)}: ${d.message}`, skipped: true };
  if (typeof r.cost_usd !== 'number') return null;
  return { text: `Last run, ${dateTime(r.created_at)}: cost USD ${r.cost_usd.toFixed(2)}${typeof d.searches === 'number' ? ` for ${d.searches} searches` : ''}, ${r.saved} kept.`, skipped: false };
}

const TONE = { kept: 'success', duplicate: 'neutral', discarded: 'danger', over_limit: 'warning' } as const;

/** Run the daily feed by hand, see what it kept, skipped and discarded, and the last runs. */
export function FeedPanel({ runs, available, keywords, paused, days }: { runs: Run[]; available: boolean; keywords: number; paused: boolean; days: string }) {
  const last = lastRunLine(runs[0]);
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
            {available ? `Runs at 09:00 Riyadh time on ${days}${paused ? ' (paused)' : ''} with ${keywords} keywords switched on (Settings); a run by hand works any day. A run that would take the month's AI spend over the budget is skipped and says so here. While paused a run by hand is a preview and saves nothing. Searches each keyword group in its own call, inside the cost ceiling in Settings. Keeps only signals with a real evidence link, skips duplicates and stops at the AI budget. Each run says how its answers read, so nothing found is never confused with an answer that could not be read.` : 'Needs 088_growth_prospecting.sql applied first.'}
          </p>
        </div>
        <PrimaryButton onClick={go} disabled={busy !== null || !available}>
          {busy ? 'Searching' : 'Run the feed now'}
        </PrimaryButton>
      </div>
      {last && (
        <p data-last-run={last.skipped ? 'skipped' : 'cost'} style={{ margin: '8px 0 0', fontSize: 13, color: last.skipped ? ADMIN_COLORS.warning : ADMIN_COLORS.textHeading }}>
          {last.text}
        </p>
      )}
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
              <span style={adminBadge(TONE[d.outcome])}>{d.outcome.replace('_', ' ')}</span> <strong>{d.company_name || 'Unnamed'}</strong>: {d.summary} {d.matched_keyword && <span style={{ color: ADMIN_COLORS.textMuted }}>[{d.matched_keyword}] </span>}<span style={{ color: ADMIN_COLORS.textMuted }}>({d.group ? `${d.group}: ` : ''}{d.why})</span>
            </li>
          ))}
        </ul>
      )}
      {runs.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          Last runs:{' '}
          {runs.map((r) => (
            <span key={r.id} style={{ display: 'block', marginTop: 2 }}>
              {dateTime(r.created_at)} {r.trigger} {r.mode === 'mock_preview' ? '(mock preview)' : ''}: {r.status}, {r.saved} kept, {r.duplicates} duplicates, {r.discarded} discarded
              {runDetail(r)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
