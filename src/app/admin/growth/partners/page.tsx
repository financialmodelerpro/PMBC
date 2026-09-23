import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PartnerForm } from '@/components/admin/growth/partners/PartnerControls';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { day, riyadhDate } from '@/lib/growth/format';
import { growthPage } from '@/lib/growth/pages';
import { PARTNER_TYPES, listPartners, partnersReady } from '@/lib/growth/partners';

export const metadata: Metadata = { title: 'Partners | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthPartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('partners');
  const sp = await searchParams;
  const type = typeof sp.type === 'string' && PARTNER_TYPES.some((t) => t.value === sp.type) ? sp.type : '';
  if (!(await partnersReady())) {
    return (
      <>
        <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
        <MigrationNotice migration="092_growth_nurture_partners.sql" table="growth_partners" effect="Partners and introductions cannot be recorded until then." />
      </>
    );
  }
  const [partners, engine] = await Promise.all([listPartners({ type: type || undefined, includeTest: sp.test === '1' }), getEngineSettings()]);
  const today = riyadhDate();
  const due = partners.filter((p) => p.status === 'active' && p.next_checkin_due && p.next_checkin_due <= today);
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <PartnerForm defaultDays={engine.values.partner_checkin_days} />
        <p style={{ margin: '10px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>You get one reminder email each morning listing the check-ins due. The default cadence is {engine.values.partner_checkin_days} days (Settings).</p>
      </section>
      {due.length > 0 && (
        <section style={{ ...adminCard, marginBottom: 16, borderColor: ADMIN_COLORS.accent }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Check-ins due ({due.length})</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {due.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/growth/partners/${p.id}`}>{p.name}</Link>, due {day(p.next_checkin_due)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: 13 }}>
        <Link href="/admin/growth/partners" style={{ fontWeight: type ? 400 : 700 }}>
          All
        </Link>
        {PARTNER_TYPES.map((t) => (
          <Link key={t.value} href={`/admin/growth/partners?type=${t.value}`} style={{ fontWeight: type === t.value ? 700 : 400 }}>
            {t.label}
          </Link>
        ))}
      </nav>
      <section style={{ ...adminCard, padding: 0 }}>
        {partners.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No partners yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Partner</th>
                  <th style={adminTh}>Type</th>
                  <th style={adminTh}>Last check-in</th>
                  <th style={adminTh}>Next</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      <Link href={`/admin/growth/partners/${p.id}`} style={{ fontWeight: 700 }}>
                        {p.name}
                      </Link>
                      {p.organisation && <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{p.organisation}</div>}
                    </td>
                    <td style={adminTd}>
                      <span style={adminBadge('neutral')}>{PARTNER_TYPES.find((t) => t.value === p.type)?.label}</span> {p.status !== 'active' && <span style={adminBadge('neutral')}>{p.status}</span>}
                      {p.is_test && <span style={{ ...adminBadge('neutral'), marginLeft: 4 }}>Test</span>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{day(p.last_checkin_at)}</td>
                    <td style={{ ...adminTd, fontSize: 12, color: p.next_checkin_due && p.next_checkin_due <= today ? ADMIN_COLORS.danger : undefined }}>{day(p.next_checkin_due)}</td>
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
