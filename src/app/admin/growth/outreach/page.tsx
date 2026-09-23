import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MessageCard } from '@/components/admin/growth/outreach/MessageCard';
import { DraftButtons, OutreachJobs } from '@/components/admin/growth/outreach/OutreachControls';
import { MockBadge } from '@/components/admin/growth/ui/kit';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { isMockMode } from '@/lib/growth/ai/provider';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { bandLabel, bandTone, day } from '@/lib/growth/format';
import { graphMailConfigured } from '@/lib/growth/graph';
import { listMessages, outreachCandidates, outreachReady } from '@/lib/growth/outreach';
import { growthPage } from '@/lib/growth/pages';
import { getGrowthSettings } from '@/lib/growth/settings';
import { describeDays } from '@/lib/growth/settingsModel';

export const metadata: Metadata = { title: 'Outreach | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;

export default async function GrowthOutreachPage() {
  await requireGrowthSession();
  const page = growthPage('outreach');
  const ready = await outreachReady();
  if (!ready) {
    return (
      <>
        <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
        <MigrationNotice migration="089_growth_outreach.sql" table="growth_messages" effect="Nothing can be drafted, approved or sent until then." />
      </>
    );
  }
  const [candidates, drafts, waiting, sent, settings, engine] = await Promise.all([
    outreachCandidates(),
    listMessages(['draft']),
    listMessages(['approved', 'scheduled', 'failed']),
    listMessages(['sent'], { limit: 40 }),
    getGrowthSettings(),
    getEngineSettings(),
  ]);
  const graphLive = graphMailConfigured();
  const s = settings.settings;

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} actions={<Link href="/admin/growth/outreach/nurture">Nurture sequence and lead magnets</Link>} />
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <OutreachJobs graphLive={graphLive} paused={engine.values.outreach_sending_paused} />
        <p style={{ margin: '10px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          Sends {describeDays(s.send_days)}, {s.send_start} to {s.send_end} Riyadh time, at most {s.daily_cold_email_cap} cold emails a day. Follow-ups on days {s.follow_up_days.join(', ')} after the first email, at most {s.max_follow_ups}. Every email carries an opt-out link; suppressed addresses are never sent to.{' '}
          {isMockMode() && (
            <>
              <MockBadge /> Drafts come from the mock AI until the Anthropic key is set.
            </>
          )}
        </p>
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="queue">
        <h2 id="queue" style={h2}>
          Ready to draft ({candidates.length})
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Leads at Prospect or Contacted with no message waiting, highest Prospect Score first, then the freshest trigger. Every draft cites the trigger shown.</p>
        {candidates.length === 0 && <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing waiting. Convert signals into leads and add a contact to each.</p>}
        {candidates.map((c) => (
          <div key={c.lead.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '12px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href={`/admin/growth/pipeline/${c.lead.id}`} style={{ fontWeight: 700 }}>
                  {c.company?.name ?? c.lead.title}
                </Link>
                <span style={adminBadge(bandTone(c.company?.prospect_band))}>
                  {c.company?.prospect_score ?? ''} {bandLabel(c.company?.prospect_band)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{c.contact ? `${c.contact.full_name}${c.contact.role_title ? `, ${c.contact.role_title}` : ''}` : 'No contact'}</div>
              {c.signal && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {day(c.signal.signal_date)}: {c.signal.summary}
                </div>
              )}
              {c.blockers.length > 0 && <div style={{ fontSize: 12, color: ADMIN_COLORS.danger, marginTop: 4 }}>Blocked: {c.blockers.join('; ')}</div>}
            </div>
            <DraftButtons leadId={c.lead.id} email={Boolean(c.contact?.email)} blocked={c.suppressed || !c.signal || !c.contact} />
          </div>
        ))}
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="drafts">
        <h2 id="drafts" style={h2}>
          Drafts to approve ({drafts.length})
        </h2>
        {drafts.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>No drafts waiting.</p> : drafts.map((m) => <MessageCard key={m.id} m={m} graphLive={graphLive} />)}
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="waiting">
        <h2 id="waiting" style={h2}>
          Approved, scheduled and failed ({waiting.length})
        </h2>
        {waiting.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing waiting to send.</p> : waiting.map((m) => <MessageCard key={m.id} m={m} graphLive={graphLive} />)}
      </section>

      <section style={adminCard} aria-labelledby="sent">
        <h2 id="sent" style={h2}>
          Recently sent
        </h2>
        {sent.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing sent yet.</p> : sent.map((m) => <MessageCard key={m.id} m={m} graphLive={graphLive} />)}
      </section>
    </>
  );
}
