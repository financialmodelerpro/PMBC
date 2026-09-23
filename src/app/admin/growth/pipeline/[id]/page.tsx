import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MessageCard } from '@/components/admin/growth/outreach/MessageCard';
import { DraftButtons } from '@/components/admin/growth/outreach/OutreachControls';
import { MeetingRequestToggle, OpportunityForm, StageMover, TaskAdd, TaskTick } from '@/components/admin/growth/pipeline/PipelineControls';
import { LeadButton } from '@/components/admin/growth/prospects/Toggle';
import { Timeline } from '@/components/admin/growth/Timeline';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { LEAD_FACTORS } from '@/lib/growth/engineSettingsModel';
import { bandLabel, bandTone, dateTime, day, sar, serviceLabel, sourceLabel, stageLabel, temperatureLabel, temperatureTone } from '@/lib/growth/format';
import { graphMailConfigured } from '@/lib/growth/graph';
import { computeLeadScore } from '@/lib/growth/leadScore';
import { VALUE_BANDS } from '@/lib/growth/outreachModel';
import { getLeadBundle } from '@/lib/growth/pipeline';

export const metadata: Metadata = { title: 'Lead | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await getLeadBundle(id);
  if (!b) notFound();
  const { lead: l, company, contact } = b;
  const score = await computeLeadScore(id);
  const graphLive = graphMailConfigured();
  const ext = l as typeof l & { sequence_status?: string; next_follow_up_at?: string | null; sequence_stopped_reason?: string | null; meeting_requested?: boolean; last_reply_at?: string | null };

  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine: Lead"
        title={l.title}
        description={[company?.name, contact?.full_name].filter(Boolean).join(', ') || undefined}
        actions={
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            {company && <Link href={`/admin/growth/prospects/${company.id}`}>Company</Link>}
            <Link href="/admin/growth/pipeline">Pipeline</Link>
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginBottom: 16 }}>
        <section style={adminCard}>
          <h2 style={h2}>Lead</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={adminBadge('neutral')}>{stageLabel(l.stage)}</span>
            {l.below_minimum && <span style={adminBadge('danger')}>Below SAR 50 million</span>}
            {l.is_test && <span style={adminBadge('neutral')}>Test</span>}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 14px', margin: '0 0 12px', fontSize: 13 }}>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Service</dt>
            <dd style={{ margin: 0 }}>{serviceLabel(l.recommended_service)}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Deal size</dt>
            <dd style={{ margin: 0 }}>{sar(l.deal_size_sar) || 'Unknown'}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Timeline</dt>
            <dd style={{ margin: 0 }}>{l.timeline ?? ''}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Source</dt>
            <dd style={{ margin: 0 }}>
              {sourceLabel(l.source)}
              {l.source_ref ? ` (${l.source_ref})` : ''}
            </dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Sequence</dt>
            <dd style={{ margin: 0 }}>
              {ext.sequence_status ?? 'none'}
              {ext.next_follow_up_at ? `, next follow-up ${dateTime(ext.next_follow_up_at)}` : ''}
              {ext.sequence_stopped_reason ? ` (${ext.sequence_stopped_reason})` : ''}
            </dd>
            {l.next_action && (
              <>
                <dt style={{ color: ADMIN_COLORS.textMuted }}>Next action</dt>
                <dd style={{ margin: 0 }}>
                  {l.next_action}
                  {l.next_action_due ? `, by ${day(l.next_action_due)}` : ''}
                </dd>
              </>
            )}
          </dl>
          {l.requirement && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{l.requirement}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StageMover leadId={l.id} stage={l.stage} />
            {'meeting_requested' in l && <MeetingRequestToggle leadId={l.id} value={Boolean(ext.meeting_requested)} />}
            {company && (
              <LeadButton
                companyId={company.id}
                leadId={l.id}
                label="Edit lead"
                contacts={contact ? [{ id: contact.id, full_name: contact.full_name }] : []}
                initial={{ title: l.title, contact_id: s(l.contact_id), stage: l.stage, recommended_service: s(l.recommended_service), requirement: s(l.requirement), deal_size_sar: s(l.deal_size_sar), timeline: s(l.timeline), source: l.source, next_action: s(l.next_action), next_action_due: s(l.next_action_due), lost_reason: s(l.lost_reason) }}
              />
            )}
          </div>
        </section>

        <section style={adminCard}>
          <h2 style={h2}>Scores</h2>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            Prospect Score:{' '}
            <span style={adminBadge(bandTone(company?.prospect_band ?? l.prospect_band))}>
              {company?.prospect_score ?? l.prospect_score ?? ''} {bandLabel(company?.prospect_band ?? l.prospect_band)}
            </span>
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            Lead Score:{' '}
            {l.lead_temperature ? (
              <span style={adminBadge(temperatureTone(l.lead_temperature))}>
                {l.lead_score} {temperatureLabel(l.lead_temperature)}
              </span>
            ) : (
              <span style={{ color: ADMIN_COLORS.textMuted }}>set once the lead engages (a reply, click, chat, meeting or meeting request)</span>
            )}
          </p>
          {score && (
            <>
              <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13 }}>
                {(l.score_reasons?.length ? l.score_reasons : score.result.reasons).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  {score.result.factors.map((f) => (
                    <tr key={f.factor}>
                      <td style={{ padding: '3px 0' }}>{LEAD_FACTORS.find((x) => x.key === f.factor)?.label}</td>
                      <td style={{ padding: '3px 6px', color: ADMIN_COLORS.textMuted }}>{f.note}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right' }}>
                        {f.points} / {f.weight}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={h2}>Opportunities</h2>
        {!b.ready && <p style={{ fontSize: 13, color: ADMIN_COLORS.warning }}>Needs 089_growth_outreach.sql applied first.</p>}
        {b.opportunities.map((o) => (
          <div key={o.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13 }}>
              <span style={adminBadge(o.status === 'won' ? 'success' : o.status === 'lost' ? 'danger' : 'neutral')}>{o.status}</span> <strong>{serviceLabel(o.service)}</strong>, {VALUE_BANDS.find((v) => v.value === o.value_band)?.label}
              {o.expected_close ? `, expected close ${day(o.expected_close)}` : ''}
              {o.lost_reason ? `. Lost: ${o.lost_reason}` : ''}
            </div>
            <OpportunityForm leadId={l.id} initial={o} />
          </div>
        ))}
        {b.ready && <OpportunityForm leadId={l.id} defaultService={l.recommended_service} />}
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={h2}>Tasks</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {b.tasks.length === 0 && <span style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>No tasks.</span>}
          {b.tasks.map((t) => (
            <TaskTick key={t.id} id={t.id} done={Boolean(t.done_at)} title={t.title} due={t.due_date} />
          ))}
        </div>
        {b.ready && <TaskAdd leadId={l.id} />}
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ ...h2, margin: 0 }}>Messages</h2>
          {b.ready && l.stage === 'prospect' && <DraftButtons leadId={l.id} email={Boolean(contact?.email)} blocked={!contact} />}
        </div>
        {b.messages.length === 0 ? <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>No messages yet.</p> : b.messages.map((m) => <MessageCard key={m.id} m={m} graphLive={graphLive} />)}
      </section>

      <section style={adminCard}>
        <h2 style={h2}>Timeline</h2>
        <Timeline rows={b.timeline} />
      </section>
    </>
  );
}
