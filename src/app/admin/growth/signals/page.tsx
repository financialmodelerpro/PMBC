import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { FeedPanel } from '@/components/admin/growth/signals/FeedPanel';
import { SignalActions } from '@/components/admin/growth/signals/SignalActions';
import { SignalAddForm } from '@/components/admin/growth/signals/SignalAddForm';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminButtonGhost, adminCard, adminInput, adminLabel, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { growthDb, tableExists } from '@/lib/growth/db';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { recentFeedRuns } from '@/lib/growth/feed';
import { activeKeywords, getKeywordLibrary } from '@/lib/growth/keywords';
import { day } from '@/lib/growth/format';
import { TRIGGER_TYPES } from '@/lib/growth/model';
import { growthPage } from '@/lib/growth/pages';
import { companyOptions } from '@/lib/growth/prospects';
import { listSignals, triggerLabel } from '@/lib/growth/signals';
import { SIGNAL_ORIGINS, parseSignalFilters } from '@/lib/growth/signalsModel';

export const metadata: Metadata = { title: 'Signals | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS_TABS = [
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'attached', label: 'Attached' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
] as const;

export default async function GrowthSignalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('signals');
  const f = parseSignalFilters(await searchParams);
  const [list, companies, has088, leadRows] = await Promise.all([
    listSignals(f),
    companyOptions(f.includeTest),
    tableExists('growth_feed_runs'),
    growthDb().from('growth_leads').select('id, title, company_id').not('stage', 'in', '(won,lost)').order('title').limit(1000),
  ]);
  const [runs, engine, library] = await Promise.all([has088 ? recentFeedRuns() : Promise.resolve([]), getEngineSettings(), getKeywordLibrary()]);
  const active = activeKeywords(library);
  const keywordCount = library.source === 'pending' ? engine.values.signal_keywords.length : active.length;
  const leads = (leadRows.data ?? []) as { id: string; title: string; company_id: string | null }[];
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { status: f.status, trigger: f.trigger, origin: f.origin, from: f.from, to: f.to, q: f.q, dup: f.dup ? '1' : '', test: f.includeTest ? '1' : '', ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      {list.missingTable && <MigrationNotice migration="083_growth_core.sql" table="growth_signals" effect="The inbox is empty until then." />}
      {!list.missingTable && !has088 && (
        <MigrationNotice migration="088_growth_prospecting.sql" table="growth_feed_runs" effect="Signals can be added and triaged now; the origin, duplicate flag and who triaged each signal are kept once it is applied." />
      )}
      {list.error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the signals: {list.error}</p>}

      <FeedPanel runs={runs} available={has088 && !engine.missing.includes('signal_keywords')} keywords={keywordCount} paused={engine.values.signal_feed_paused} />
      <SignalAddForm companies={companies} keywords={library.source === 'pending' ? [] : active.map((k) => ({ id: k.id, keyword: k.keyword, trigger: k.trigger, enabled: true }))} />

      <nav aria-label="Signal status" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={qs({ status: t.value })}
            aria-current={f.status === t.value ? 'page' : undefined}
            style={{ ...adminButtonGhost, background: f.status === t.value ? ADMIN_COLORS.primary : '#FFFFFF', color: f.status === t.value ? '#FFFFFF' : ADMIN_COLORS.primaryDeep, textDecoration: 'none' }}
          >
            {t.label}
            {t.value !== 'all' && <span style={{ opacity: 0.8 }}>{list.counts[t.value] ?? 0}</span>}
          </Link>
        ))}
      </nav>

      <form method="get" style={{ ...adminCard, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, alignItems: 'end' }}>
        <input type="hidden" name="status" value={f.status} />
        <label>
          <span style={adminLabel}>Trigger</span>
          <select name="trigger" defaultValue={f.trigger} style={adminInput}>
            <option value="">Any</option>
            {TRIGGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={adminLabel}>Origin</span>
          <select name="origin" defaultValue={f.origin} style={adminInput}>
            <option value="">Any</option>
            {SIGNAL_ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={adminLabel}>From</span>
          <input type="date" name="from" defaultValue={f.from} style={adminInput} />
        </label>
        <label>
          <span style={adminLabel}>To</span>
          <input type="date" name="to" defaultValue={f.to} style={adminInput} />
        </label>
        <label>
          <span style={adminLabel}>Search</span>
          <input name="q" defaultValue={f.q} style={adminInput} placeholder="Company or summary" />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <input type="checkbox" name="dup" value="1" defaultChecked={f.dup} /> Duplicates only
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} /> Include test rows
        </label>
        <button type="submit" style={adminButtonGhost}>
          Filter
        </button>
      </form>

      <section style={{ ...adminCard, padding: 0 }}>
        {list.rows.length === 0 ? (
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No signals match. Add one above, or wait for the daily feed.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Date</th>
                  <th style={adminTh}>Signal</th>
                  <th style={adminTh}>Status</th>
                  <th style={adminTh}>Triage</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((s) => (
                  <tr key={s.id} style={{ verticalAlign: 'top' }}>
                    <td style={{ ...adminTd, whiteSpace: 'nowrap', fontSize: 12 }}>{day(s.signal_date)}</td>
                    <td style={{ ...adminTd, minWidth: 280 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ color: ADMIN_COLORS.textHeading }}>
                          {s.company_id ? <Link href={`/admin/growth/prospects/${s.company_id}`}>{s.companyLabel}</Link> : s.companyLabel}
                        </strong>
                        <span style={adminBadge('neutral')}>{triggerLabel(s.trigger_type)}</span>
                        {s.origin && s.origin !== 'manual' && <span style={adminBadge('neutral')}>{SIGNAL_ORIGINS.find((o) => o.value === s.origin)?.label}</span>}
                        {s.duplicate_of && <span style={adminBadge('warning')}>Possible duplicate</span>}
                        {s.is_test && <span style={adminBadge('neutral')}>Test</span>}
                      </div>
                      <div style={{ fontSize: 13 }}>{s.summary}</div>
                      {s.matched_keyword && <div style={{ fontSize: 12, marginTop: 4, color: ADMIN_COLORS.textMuted }}>Keyword: {s.matched_keyword}</div>}
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <a href={s.evidence_url} target="_blank" rel="noopener noreferrer nofollow">
                          Evidence{s.source_name ? `: ${s.source_name}` : ''}
                        </a>
                      </div>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      <span style={adminBadge(s.status === 'new' ? 'warning' : s.status === 'dismissed' ? 'neutral' : 'success')}>{s.status}</span>
                      {s.dismissed_reason && <div style={{ marginTop: 4, color: ADMIN_COLORS.textMuted }}>{s.dismissed_reason}</div>}
                      {s.triaged_by_name && (
                        <div style={{ marginTop: 4, color: ADMIN_COLORS.textMicro }}>
                          {s.triaged_by_name}, {day(s.triaged_at)}
                        </div>
                      )}
                    </td>
                    <td style={adminTd}>
                      <SignalActions signal={s} companies={companies} leads={leads} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
