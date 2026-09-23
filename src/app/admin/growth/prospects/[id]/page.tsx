import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ResearchPanel } from '@/components/admin/growth/prospects/ResearchPanel';
import { ScoreControls } from '@/components/admin/growth/prospects/ScorePanel';
import { ContactButton, EditCompanyButton, LeadButton } from '@/components/admin/growth/prospects/Toggle';
import { Timeline } from '@/components/admin/growth/Timeline';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { SCORING_FACTORS } from '@/lib/growth/engineSettingsModel';
import { bandLabel, bandTone, day, sar, serviceLabel, sourceLabel, stageLabel, temperatureLabel, temperatureTone } from '@/lib/growth/format';
import { CONSENT_STATUSES } from '@/lib/growth/model';
import { computeCompanyScore, getCompanyBundle } from '@/lib/growth/prospects';
import { triggerLabel } from '@/lib/growth/signals';
import { checkSuppression } from '@/lib/growth/suppression';

export const metadata: Metadata = { title: 'Prospect | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const bundle = await getCompanyBundle(id);
  if (!bundle) notFound();
  const { company: c, contacts, leads, signals, briefs, timeline } = bundle;
  const live = await computeCompanyScore(id);
  const stored = 'computed_score' in c;
  const suppression = new Map<string, boolean>();
  await Promise.all(contacts.filter((x) => x.email).map(async (x) => suppression.set(x.id, (await checkSuppression(x.email!)).suppressed)));
  const contactOptions = contacts.map((x) => ({ id: x.id, full_name: x.full_name }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine: Prospect"
        title={c.name}
        description={[c.sector, c.city, c.country].filter(Boolean).join(', ') || undefined}
        actions={<Link href="/admin/growth/prospects">All prospects</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, marginBottom: 16 }}>
        <section style={adminCard} aria-labelledby="profile">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 id="profile" style={h2}>
              Profile
            </h2>
            {c.is_test && <span style={adminBadge('neutral')}>Test</span>}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 14px', margin: '0 0 12px', fontSize: 13 }}>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Website</dt>
            <dd style={{ margin: 0 }}>{c.website_domain ?? ''}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Status</dt>
            <dd style={{ margin: 0 }}>{c.status}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Likely service</dt>
            <dd style={{ margin: 0 }}>{serviceLabel(c.likely_service)}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Known scale</dt>
            <dd style={{ margin: 0 }}>{sar(c.scale_sar) || 'Unknown'}</dd>
            <dt style={{ color: ADMIN_COLORS.textMuted }}>Source</dt>
            <dd style={{ margin: 0 }}>{sourceLabel(c.source)}</dd>
            {c.linkedin_url && (
              <>
                <dt style={{ color: ADMIN_COLORS.textMuted }}>LinkedIn</dt>
                <dd style={{ margin: 0 }}>
                  <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer nofollow">
                    Company page
                  </a>
                </dd>
              </>
            )}
          </dl>
          {c.description && <p style={{ fontSize: 13, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{c.description}</p>}
          {c.notes && <p style={{ fontSize: 12, margin: '0 0 12px', color: ADMIN_COLORS.textMuted, whiteSpace: 'pre-wrap' }}>{c.notes}</p>}
          <EditCompanyButton
            id={c.id}
            initial={{
              name: c.name,
              website_domain: s(c.website_domain),
              sector: s(c.sector),
              city: s(c.city),
              country: s(c.country),
              description: s(c.description),
              linkedin_url: s(c.linkedin_url),
              likely_service: s(c.likely_service),
              status: c.status,
              notes: s(c.notes),
              source: s(c.source),
              scale_sar: s(c.scale_sar),
            }}
          />
        </section>

        <section style={adminCard} aria-labelledby="score">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 id="score" style={h2}>
              Prospect Score
            </h2>
            <span style={adminBadge(bandTone(stored ? c.prospect_band : live?.band))}>
              {stored ? c.prospect_score ?? '' : live?.score} {bandLabel(stored ? c.prospect_band : live?.band)}
            </span>
          </div>
          {!stored && <p style={{ fontSize: 12, color: ADMIN_COLORS.warning, margin: '0 0 8px' }}>Shown from the rules now; stored once 088_growth_prospecting.sql is applied.</p>}
          {c.score_override && (
            <p style={{ fontSize: 12, margin: '0 0 8px' }}>
              <strong>Set by hand:</strong> {c.override_reason}. The rules give {c.computed_score ?? live?.score}.
            </p>
          )}
          <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13 }}>
            {(stored && c.score_reasons?.length ? c.score_reasons : live?.reasons ?? []).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {live && (
            <table style={{ ...adminTable, marginBottom: 10 }}>
              <tbody>
                {live.factors.map((f) => (
                  <tr key={f.factor}>
                    <td style={{ ...adminTd, padding: '5px 8px', fontSize: 12 }}>{SCORING_FACTORS.find((x) => x.key === f.factor)?.label}</td>
                    <td style={{ ...adminTd, padding: '5px 8px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>{f.note}</td>
                    <td style={{ ...adminTd, padding: '5px 8px', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {f.points} / {f.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {c.scored_at && <p style={{ fontSize: 11, color: ADMIN_COLORS.textMicro, margin: '0 0 8px' }}>Scored {day(c.scored_at)}</p>}
          <ScoreControls companyId={c.id} overridden={Boolean(c.score_override)} available={stored} />
        </section>
      </div>

      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="contacts">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 id="contacts" style={h2}>
            Contacts
          </h2>
        </div>
        {contacts.length === 0 && <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted, margin: '0 0 12px' }}>No contacts yet.</p>}
        {contacts.map((x) => (
          <div key={x.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong>{x.full_name}</strong>
              {x.role_title && <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{x.role_title}</span>}
              {x.is_decision_maker && <span style={adminBadge('success')}>Decision-maker</span>}
              <span style={adminBadge(x.consent_status === 'opted_out' || x.consent_status === 'do_not_contact' ? 'danger' : 'neutral')}>{CONSENT_STATUSES.find((k) => k.value === x.consent_status)?.label}</span>
              {suppression.get(x.id) && <span style={adminBadge('danger')}>Suppressed: never contactable</span>}
            </div>
            <div style={{ fontSize: 12, color: ADMIN_COLORS.textBody }}>{[x.email, x.phone].filter(Boolean).join(' / ')}</div>
            <ContactButton
              companyId={c.id}
              contactId={x.id}
              label="Edit contact"
              initial={{ full_name: x.full_name, role_title: s(x.role_title), email: s(x.email), phone: s(x.phone), linkedin_url: s(x.linkedin_url), is_decision_maker: x.is_decision_maker, consent_status: x.consent_status, consent_source: s(x.consent_source), notes: s(x.notes) }}
            />
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <ContactButton companyId={c.id} label="Add contact" />
        </div>
      </section>

      <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="leads">
        <h2 id="leads" style={{ ...h2, marginBottom: 12 }}>
          Leads
        </h2>
        {leads.length === 0 && <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted, margin: '0 0 12px' }}>No leads yet.</p>}
        {leads.map((l) => (
          <div key={l.id} style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href={`/admin/growth/pipeline/${l.id}`} style={{ fontWeight: 700 }}>
                {l.title}
              </Link>
              <span style={adminBadge('neutral')}>{stageLabel(l.stage)}</span>
              {l.lead_temperature && <span style={adminBadge(temperatureTone(l.lead_temperature))}>{temperatureLabel(l.lead_temperature)} {l.lead_score ?? ''}</span>}
              {l.below_minimum && <span style={adminBadge('danger')}>Below SAR 50 million</span>}
            </div>
            <div style={{ fontSize: 12, color: ADMIN_COLORS.textBody }}>
              {[serviceLabel(l.recommended_service), sar(l.deal_size_sar), l.timeline, sourceLabel(l.source), l.next_action ? `Next: ${l.next_action}${l.next_action_due ? ` by ${day(l.next_action_due)}` : ''}` : ''].filter(Boolean).join(' / ')}
            </div>
            <LeadButton
              companyId={c.id}
              leadId={l.id}
              label="Edit lead"
              contacts={contactOptions}
              initial={{ title: l.title, contact_id: s(l.contact_id), stage: l.stage, recommended_service: s(l.recommended_service), requirement: s(l.requirement), deal_size_sar: s(l.deal_size_sar), timeline: s(l.timeline), source: l.source, next_action: s(l.next_action), next_action_due: s(l.next_action_due), lost_reason: s(l.lost_reason) }}
            />
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <LeadButton companyId={c.id} label="Open a lead" contacts={contactOptions} />
        </div>
      </section>

      <section style={{ ...adminCard, padding: 0, marginBottom: 16 }} aria-labelledby="signals">
        <div style={{ padding: '16px 20px' }}>
          <h2 id="signals" style={h2}>
            Signals
          </h2>
        </div>
        {signals.length === 0 ? (
          <p style={{ padding: '0 20px 16px', margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No signals linked yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Date</th>
                  <th style={adminTh}>Trigger</th>
                  <th style={adminTh}>Summary</th>
                  <th style={adminTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((x) => (
                  <tr key={x.id}>
                    <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>{day(x.signal_date)}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{triggerLabel(x.trigger_type)}</td>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      {x.summary}{' '}
                      <a href={x.evidence_url} target="_blank" rel="noopener noreferrer nofollow">
                        Evidence
                      </a>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResearchPanel companyId={c.id} briefs={briefs} available={bundle.briefsAvailable} />

      <section style={{ ...adminCard, marginTop: 16 }} aria-labelledby="timeline">
        <h2 id="timeline" style={{ ...h2, marginBottom: 12 }}>
          Timeline
        </h2>
        <Timeline rows={timeline} />
      </section>
    </>
  );
}
