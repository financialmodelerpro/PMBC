import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminButtonGhost, adminButtonPrimary, adminCard, adminInput, adminLabel, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { tableExists } from '@/lib/growth/db';
import { bandLabel, bandTone, day, sar, serviceLabel, sourceLabel } from '@/lib/growth/format';
import { COMPANY_STATUSES, LEAD_SOURCES, PROSPECT_BANDS } from '@/lib/growth/model';
import { growthPage } from '@/lib/growth/pages';
import { listCompanies } from '@/lib/growth/prospects';
import { parseProspectFilters } from '@/lib/growth/prospectsModel';

export const metadata: Metadata = { title: 'Prospects | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthProspectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('prospects');
  const f = parseProspectFilters(await searchParams);
  const [list, has088] = await Promise.all([listCompanies(f), tableExists('growth_research_briefs')]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title={page.title}
        description={page.purpose}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/admin/growth/prospects/import" style={{ ...adminButtonGhost, textDecoration: 'none' }}>
              Import CSV
            </Link>
            <Link href="/admin/growth/prospects/new" style={{ ...adminButtonPrimary, textDecoration: 'none' }}>
              New company
            </Link>
          </div>
        }
      />
      {list.missingTable && <MigrationNotice migration="083_growth_core.sql" table="growth_companies" effect="The list is empty until then." />}
      {!list.missingTable && !has088 && (
        <MigrationNotice migration="088_growth_prospecting.sql" table="growth_research_briefs" effect="Companies can be added now; scores are shown on each company but stored, banded and listed here once it is applied." />
      )}
      {list.error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the prospects: {list.error}</p>}

      <form method="get" style={{ ...adminCard, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, alignItems: 'end' }}>
        <label>
          <span style={adminLabel}>Band</span>
          <select name="band" defaultValue={f.band} style={adminInput}>
            <option value="">Any</option>
            {PROSPECT_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
            <option value="unscored">Not scored</option>
          </select>
        </label>
        <label>
          <span style={adminLabel}>Status</span>
          <select name="status" defaultValue={f.status} style={adminInput}>
            <option value="">Any but archived</option>
            {COMPANY_STATUSES.map((s) => (
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
          <input name="q" defaultValue={f.q} style={adminInput} placeholder="Company name" />
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
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No prospects match. Convert a signal, add a company or import a CSV.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Company</th>
                  <th style={adminTh}>Score</th>
                  <th style={adminTh}>Likely service</th>
                  <th style={adminTh}>Latest signal</th>
                  <th style={{ ...adminTh, textAlign: 'right' }}>Contacts</th>
                  <th style={{ ...adminTh, textAlign: 'right' }}>Leads</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((c) => (
                  <tr key={c.id}>
                    <td style={{ ...adminTd, minWidth: 220 }}>
                      <Link href={`/admin/growth/prospects/${c.id}`} style={{ fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
                        {c.name}
                      </Link>
                      {c.is_test && <span style={{ ...adminBadge('neutral'), marginLeft: 6 }}>Test</span>}
                      <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{[c.sector, c.city, c.country].filter(Boolean).join(', ')}</div>
                      {(c.source || c.scale_sar) && <div style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{[c.source ? sourceLabel(c.source) : '', c.scale_sar ? sar(c.scale_sar) : ''].filter(Boolean).join(', ')}</div>}
                    </td>
                    <td style={adminTd}>
                      <span style={adminBadge(bandTone(c.prospect_band))}>
                        {c.prospect_score ?? ''} {bandLabel(c.prospect_band)}
                      </span>
                      {c.score_override && <div style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>Set by hand</div>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{serviceLabel(c.likely_service)}</td>
                    <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {day(c.latestSignal)}
                      {c.newSignals > 0 && <span style={{ ...adminBadge('warning'), marginLeft: 6 }}>{c.newSignals} new</span>}
                    </td>
                    <td style={{ ...adminTd, textAlign: 'right' }}>{c.contacts}</td>
                    <td style={{ ...adminTd, textAlign: 'right' }}>{c.leads}</td>
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
