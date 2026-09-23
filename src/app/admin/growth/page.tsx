import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DataLayerStatus } from '@/components/admin/growth/DataLayerStatus';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { bandTone, dateTime } from '@/lib/growth/format';
import { homeCounts } from '@/lib/growth/home';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function Tile({ label, value, href, note }: { label: string; value: number | null; href?: string; note?: string }) {
  const body = (
    <>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ADMIN_COLORS.textMuted }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{value ?? 'n/a'}</span>
      {note && <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{note}</span>}
    </>
  );
  const style = { ...adminCard, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 4, textDecoration: 'none' };
  return href ? (
    <Link href={href} style={style}>
      {body}
    </Link>
  ) : (
    <div style={style}>{body}</div>
  );
}

export default async function GrowthHomePage() {
  await requireGrowthSession();
  const page = growthPage('home');
  const c = await homeCounts();
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginBottom: 16 }}>
        <Tile label="New signals" value={c.newSignals} href="/admin/growth/signals" note={c.duplicateSignals ? `${c.duplicateSignals} possible duplicates` : 'Waiting for triage'} />
        <Tile label="Prospects" value={c.companies} href="/admin/growth/prospects" />
        <Tile label="Open leads" value={c.openLeads} href="/admin/growth/pipeline" />
      </div>
      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="bands">
        <h2 id="bands" style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
          Prospects by band
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {c.bands.map((b) => (
            <Link key={b.value} href={`/admin/growth/prospects?band=${b.value}`} style={{ ...adminBadge(bandTone(b.value)), fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
              {b.label}: {b.count}
            </Link>
          ))}
          <Link href="/admin/growth/prospects?band=unscored" style={{ ...adminBadge('neutral'), fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
            Not scored: {c.unscored}
          </Link>
        </div>
      </section>
      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="recent">
        <h2 id="recent" style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
          Recent activity
        </h2>
        {c.recent.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.recent.map((r) => (
              <li key={r.id} style={{ fontSize: 13, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, minWidth: 140 }}>{dateTime(r.created_at)}</span>
                <span>{r.company_id ? <Link href={`/admin/growth/prospects/${r.company_id}`}>{r.summary ?? r.action}</Link> : r.summary ?? r.action}</span>
              </li>
            ))}
          </ul>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 12 }}>
          <Link href="/admin/growth/settings/audit">Full audit log</Link>
        </p>
      </section>
      <DataLayerStatus />
    </>
  );
}
