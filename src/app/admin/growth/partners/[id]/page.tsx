import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CheckinButton, IntroForm, PartnerForm } from '@/components/admin/growth/partners/PartnerControls';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { dateTime, day, stageLabel } from '@/lib/growth/format';
import { INTRO_OUTCOMES, PARTNER_TYPES, getPartnerBundle } from '@/lib/growth/partners';

export const metadata: Metadata = { title: 'Partner | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await getPartnerBundle(id);
  if (!b) notFound();
  const { partner: p } = b;
  const engine = await getEngineSettings();
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine: Partner" title={p.name} description={[PARTNER_TYPES.find((t) => t.value === p.type)?.label, p.organisation].filter(Boolean).join(', ')} actions={<Link href="/admin/growth/partners">All partners</Link>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, marginBottom: 16 }}>
        <section style={adminCard}>
          <h2 style={h2}>Details</h2>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}>{[p.email, p.phone].filter(Boolean).join(' / ')}</p>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}>
            Check in every {p.checkin_every_days ?? engine.values.partner_checkin_days} days. Last {day(p.last_checkin_at) || 'never'}, next {day(p.next_checkin_due)}.
          </p>
          {p.notes && <p style={{ margin: '0 0 10px', fontSize: 12, color: ADMIN_COLORS.textMuted, whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
          <PartnerForm partner={p} defaultDays={engine.values.partner_checkin_days} />
        </section>
        <section style={adminCard}>
          <h2 style={h2}>Check-ins</h2>
          <CheckinButton id={p.id} />
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {b.checkins.map((c) => (
              <li key={c.id}>
                {dateTime(c.created_at)}
                {c.note ? `: ${c.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={h2}>Introductions</h2>
        <IntroForm partnerId={p.id} />
        {b.intros.map((i) => (
          <div key={i.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13 }}>
              {day(i.introduced_on)}: {i.direction === 'to_us' ? `introduced ${i.company_name} to us` : `we introduced ${i.company_name}`} <span style={adminBadge(i.outcome === 'won' ? 'success' : i.outcome === 'lost' ? 'danger' : 'neutral')}>{INTRO_OUTCOMES.find((o) => o.value === i.outcome)?.label}</span>
              {i.lead_id && (
                <>
                  {' '}
                  <Link href={`/admin/growth/pipeline/${i.lead_id}`}>Lead</Link>
                </>
              )}
            </div>
            {i.notes && <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{i.notes}</div>}
            <IntroForm partnerId={p.id} intro={i} />
          </div>
        ))}
      </section>
      <section style={adminCard}>
        <h2 style={h2}>Leads referred ({b.leads.length})</h2>
        {b.leads.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>None yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {b.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/growth/pipeline/${l.id}`}>{l.title}</Link> ({stageLabel(l.stage)})
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
