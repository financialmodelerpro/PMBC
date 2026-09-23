import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ADMIN_COLORS, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { DIMENSIONS, PERIODS, analytics, type Dimension, type FunnelRow } from '@/lib/growth/analytics';
import { sourceLabel } from '@/lib/growth/format';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Analytics | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '');

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div style={{ ...adminCard, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ADMIN_COLORS.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: ADMIN_COLORS.textHeading, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{note}</div>}
    </div>
  );
}

function FunnelTable({ rows, label }: { rows: FunnelRow[]; label: string }) {
  const num = { ...adminTd, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={adminTable}>
        <thead style={adminThead}>
          <tr>
            <th style={adminTh}>{label}</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Leads</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Contacted</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Replied</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Qualified</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Meetings</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Proposals</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Won</th>
            <th style={{ ...adminTh, textAlign: 'right' }}>Lead to meeting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ ...adminTd, fontSize: 13 }}>{label === 'Source' ? sourceLabel(r.key) : r.key}</td>
              <td style={num}>{r.leads}</td>
              <td style={num}>{r.contacted}</td>
              <td style={num}>{r.replied}</td>
              <td style={num}>{r.qualified}</td>
              <td style={num}>{r.meetings}</td>
              <td style={num}>{r.proposals}</td>
              <td style={num}>{r.won}</td>
              <td style={num}>{rate(r.meetings, r.leads)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GrowthAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('analytics');
  const sp = await searchParams;
  const period = typeof sp.period === 'string' && PERIODS.some((p) => p.value === sp.period) ? sp.period : '90';
  const dim = (typeof sp.by === 'string' && DIMENSIONS.some((d) => d.value === sp.by) ? sp.by : 'source') as Dimension;
  const a = await analytics(period);
  const t = a.totals;
  const q = (patch: Record<string, string>) => `?${new URLSearchParams({ period, by: dim, ...patch })}`;
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} actions={<Link href="/admin/growth/analytics/scoring">Scoring review</Link>} />
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
        {PERIODS.map((p) => (
          <Link key={p.value} href={q({ period: p.value })} style={{ fontWeight: p.value === period ? 700 : 400 }}>
            {p.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12, marginBottom: 16 }}>
        <Tile label="Prospects added" value={t.prospectsAdded} />
        <Tile label="Messages sent" value={t.messagesSent} note={t.mockSends ? `${t.mockSends} mock sends not counted` : undefined} />
        <Tile label="Reply rate" value={pct(t.replyRate)} note={`${t.replies} replies`} />
        <Tile label="Website chats" value={t.chats} />
        <Tile label="Qualification rate" value={pct(t.qualificationRate)} note={`${t.qualifiedChats} Hot or Warm chats`} />
        <Tile label="Meetings" value={t.meetings} />
        <Tile label="Proposals" value={t.proposals} />
        <Tile label="Wins" value={t.wins} />
        <Tile label="AI cost (USD)" value={t.aiCostUsd.toFixed(2)} note={`${t.aiCalls} calls`} />
        <Tile label="Cost per qualified lead" value={t.costPerQualifiedLead === null ? 'n/a' : `USD ${t.costPerQualifiedLead.toFixed(2)}`} note={`${t.qualifiedLeads} qualified leads`} />
      </div>
      <section style={{ ...adminCard, padding: 0, marginBottom: 16 }}>
        <h2 style={{ margin: 0, padding: '14px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Funnel</h2>
        <FunnelTable rows={[a.funnel]} label="Leads created in the period" />
      </section>
      <section style={{ ...adminCard, padding: 0 }}>
        <div style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>By</h2>
          {DIMENSIONS.map((d) => (
            <Link key={d.value} href={q({ by: d.value })} style={{ fontSize: 13, fontWeight: d.value === dim ? 700 : 400 }}>
              {d.label}
            </Link>
          ))}
        </div>
        <FunnelTable rows={a.breakdowns[dim]} label={DIMENSIONS.find((d) => d.value === dim)?.label ?? ''} />
      </section>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Real records only. A lead counts at a stage if it is there now or passed through it. Mock sends are not counted as sent.</p>
    </>
  );
}
