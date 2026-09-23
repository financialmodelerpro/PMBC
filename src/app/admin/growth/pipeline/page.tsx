import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StageMover } from '@/components/admin/growth/pipeline/PipelineControls';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminButtonGhost, adminCard, adminInput, adminLabel, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { tableExists } from '@/lib/growth/db';
import { bandLabel, bandTone, day, sar, serviceLabel, sourceLabel, stageLabel, temperatureLabel, temperatureTone } from '@/lib/growth/format';
import { GROWTH_SERVICES, LEAD_SOURCES, PIPELINE_STAGES } from '@/lib/growth/model';
import { growthPage } from '@/lib/growth/pages';
import { listPipeline, parsePipelineFilters } from '@/lib/growth/pipeline';

export const metadata: Metadata = { title: 'Pipeline | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthPipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('pipeline');
  const f = parsePipelineFilters(await searchParams);
  const [ready, list] = await Promise.all([tableExists('growth_opportunities'), listPipeline(f)]);
  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ temperature: f.temperature, service: f.service, source: f.source, q: f.q, test: f.includeTest ? '1' : '', view: f.view, ...patch })) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };
  const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);

  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title={page.title}
        description={page.purpose}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href={q({ view: 'board' })} style={{ ...adminButtonGhost, textDecoration: 'none', ...(f.view === 'board' ? { background: ADMIN_COLORS.primary, color: '#fff' } : {}) }}>
              Board
            </Link>
            <Link href={q({ view: 'table' })} style={{ ...adminButtonGhost, textDecoration: 'none', ...(f.view === 'table' ? { background: ADMIN_COLORS.primary, color: '#fff' } : {}) }}>
              Table
            </Link>
          </div>
        }
      />
      {!ready && <MigrationNotice migration="089_growth_outreach.sql" table="growth_opportunities" effect="Leads and stages work now; opportunities and tasks wait for it." />}
      {list.error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the pipeline: {list.error}</p>}

      <form method="get" style={{ ...adminCard, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, alignItems: 'end' }}>
        <input type="hidden" name="view" value={f.view} />
        <label>
          <span style={adminLabel}>Temperature</span>
          <select name="temperature" defaultValue={f.temperature} style={adminInput}>
            <option value="">Any</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="unscored">Not scored</option>
          </select>
        </label>
        <label>
          <span style={adminLabel}>Service</span>
          <select name="service" defaultValue={f.service} style={adminInput}>
            <option value="">Any</option>
            {GROWTH_SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={adminLabel}>Source</span>
          <select name="source" defaultValue={f.source} style={adminInput}>
            <option value="">Any</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={adminLabel}>Search</span>
          <input name="q" defaultValue={f.q} style={adminInput} placeholder="Lead title" />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} /> Include test rows
        </label>
        <button type="submit" style={adminButtonGhost}>
          Filter
        </button>
      </form>

      {f.view === 'board' ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
          {PIPELINE_STAGES.map((st) => {
            const leads = list.leads.filter((l) => l.stage === st.value);
            return (
              <section key={st.value} aria-label={st.label} style={{ ...adminCard, padding: 12, minWidth: 240, maxWidth: 260, flexShrink: 0, background: ADMIN_COLORS.altBg }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
                  {st.label} <span style={{ color: ADMIN_COLORS.textMuted }}>{leads.length}</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leads.map((l) => (
                    <article key={l.id} style={{ background: '#fff', border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 12 }}>
                      <Link href={`/admin/growth/pipeline/${l.id}`} style={{ fontWeight: 700, fontSize: 13, color: ADMIN_COLORS.textHeading }}>
                        {l.companyName ?? l.title}
                      </Link>
                      <div style={{ color: ADMIN_COLORS.textMuted }}>{l.title}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '6px 0' }}>
                        {l.lead_temperature ? <span style={adminBadge(temperatureTone(l.lead_temperature))}>{temperatureLabel(l.lead_temperature)} {l.lead_score}</span> : <span style={adminBadge(bandTone(l.prospect_band))}>{bandLabel(l.prospect_band)}</span>}
                        {l.below_minimum && <span style={adminBadge('danger')}>Under SAR 50m</span>}
                        {l.is_test && <span style={adminBadge('neutral')}>Test</span>}
                      </div>
                      {l.openValue && <div>{l.openValue}</div>}
                      {l.nextTaskDue && <div style={{ color: l.nextTaskDue < today ? ADMIN_COLORS.danger : ADMIN_COLORS.textMuted }}>Next due {day(l.nextTaskDue)}</div>}
                      <div style={{ marginTop: 6 }}>
                        <StageMover leadId={l.id} stage={l.stage} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section style={{ ...adminCard, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Lead</th>
                  <th style={adminTh}>Stage</th>
                  <th style={adminTh}>Score</th>
                  <th style={adminTh}>Service and size</th>
                  <th style={adminTh}>Opportunity</th>
                  <th style={adminTh}>Next due</th>
                  <th style={adminTh}>Source</th>
                </tr>
              </thead>
              <tbody>
                {list.leads.map((l) => (
                  <tr key={l.id}>
                    <td style={{ ...adminTd, minWidth: 200 }}>
                      <Link href={`/admin/growth/pipeline/${l.id}`} style={{ fontWeight: 700 }}>
                        {l.companyName ?? l.title}
                      </Link>
                      <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                        {l.title}
                        {l.contactName ? `, ${l.contactName}` : ''}
                      </div>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {stageLabel(l.stage)}
                      <div style={{ color: ADMIN_COLORS.textMicro }}>since {day(l.stage_changed_at)}</div>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {l.lead_temperature ? <span style={adminBadge(temperatureTone(l.lead_temperature))}>{temperatureLabel(l.lead_temperature)} {l.lead_score}</span> : <span style={adminBadge(bandTone(l.prospect_band))}>{l.prospect_score ?? ''} {bandLabel(l.prospect_band)}</span>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{[serviceLabel(l.recommended_service), sar(l.deal_size_sar)].filter(Boolean).join(', ')}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{l.openValue ?? ''}</td>
                    <td style={{ ...adminTd, fontSize: 12, color: l.nextTaskDue && l.nextTaskDue < today ? ADMIN_COLORS.danger : undefined }}>{day(l.nextTaskDue)}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{sourceLabel(l.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
