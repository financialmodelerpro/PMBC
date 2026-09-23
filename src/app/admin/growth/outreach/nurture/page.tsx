import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MagnetEditor, NurtureRunButtons, StepEditor } from '@/components/admin/growth/nurture/NurtureControls';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { growthDb } from '@/lib/growth/db';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { dateTime } from '@/lib/growth/format';
import { listMagnets, listSteps, nurtureConfigured, nurtureReady } from '@/lib/growth/nurture';

export const metadata: Metadata = { title: 'Nurture | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;

export default async function NurturePage() {
  await requireGrowthSession();
  const ready = await nurtureReady();
  if (!ready) {
    return (
      <>
        <AdminPageHeader eyebrow="Growth Engine" title="Nurture" description="The educational sequence and lead magnets for opted-in contacts." />
        <MigrationNotice migration="092_growth_nurture_partners.sql" table="growth_nurture_steps" effect="Nothing is synced or sent until then." />
      </>
    );
  }
  const [steps, magnets, engine, subs, optedIn] = await Promise.all([
    listSteps(),
    listMagnets(),
    getEngineSettings(),
    growthDb().from('growth_contacts').select('id, full_name, email, nurture_step, nurture_next_at, brevo_synced_at').eq('nurture_status', 'subscribed').eq('is_test', false).order('nurture_next_at').limit(500),
    growthDb().from('growth_contacts').select('id, full_name, email').eq('consent_status', 'opted_in').eq('is_test', false).not('email', 'is', null).order('full_name').limit(1000),
  ]);
  const on = engine.values.nurture_enabled;
  const real = nurtureConfigured();
  const subscribers = (subs.data ?? []) as { id: string; full_name: string; email: string; nurture_step: number; nurture_next_at: string | null; brevo_synced_at: string | null }[];
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title="Nurture" description="The educational sequence and lead magnets for opted-in contacts only. Suppression is checked before every email, and every email carries an opt-out link." actions={<Link href="/admin/growth/outreach">Outreach</Link>} />
      <section style={{ ...adminCard, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={adminBadge(on ? 'success' : 'neutral')}>{on ? 'Nurture on' : 'Nurture off in Settings'}</span>
          <span style={adminBadge(real ? 'success' : 'warning')}>{real ? 'Brevo connected' : 'Mock mode: GROWTH_BREVO_LIST_ID not set, nothing is sent'}</span>
        </div>
        <NurtureRunButtons />
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>The sync and the sequence also run each morning at 09:00 Riyadh time. Contacts sync with SECTOR, SERVICE_INTEREST, STAGE and COMPANY attributes for segments in Brevo.</p>
      </section>
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={h2}>The sequence</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((s) => (
            <div key={s.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, paddingTop: 10 }}>
              <StepEditor step={s} nextStep={s.step} />
            </div>
          ))}
          <StepEditor nextStep={(steps.at(-1)?.step ?? 0) + 1} />
        </div>
      </section>
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={h2}>Lead magnets</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {magnets.map((m) => (
            <div key={m.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, paddingTop: 10 }}>
              <MagnetEditor magnet={m} contacts={((optedIn.data ?? []) as { id: string; full_name: string; email: string }[]).map((c) => ({ id: c.id, label: `${c.full_name} (${c.email})` }))} />
            </div>
          ))}
          <MagnetEditor contacts={[]} />
        </div>
      </section>
      <section style={{ ...adminCard, padding: 0 }}>
        <h2 style={{ ...h2, padding: '14px 20px', margin: 0 }}>Subscribed contacts ({subscribers.length})</h2>
        {subscribers.length === 0 ? (
          <p style={{ padding: '0 20px 16px', margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No one yet. Contacts who opt in on the website chat are subscribed; opted-in contacts can be subscribed from their company page.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Contact</th>
                  <th style={adminTh}>Step sent</th>
                  <th style={adminTh}>Next</th>
                  <th style={adminTh}>Brevo</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((c) => (
                  <tr key={c.id}>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      {c.full_name}
                      <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{c.email}</div>
                    </td>
                    <td style={adminTd}>{c.nurture_step}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{dateTime(c.nurture_next_at)}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{c.brevo_synced_at ? `Synced ${dateTime(c.brevo_synced_at)}` : 'Not yet'}</td>
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
