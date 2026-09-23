import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MeetingActions } from '@/components/admin/growth/meetings/MeetingControls';
import { MessageCard } from '@/components/admin/growth/outreach/MessageCard';
import { MockBadge } from '@/components/admin/growth/ui/kit';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { dateTime, serviceLabel } from '@/lib/growth/format';
import { graphMailConfigured } from '@/lib/growth/graph';
import { getMeeting } from '@/lib/growth/meetings';
import { listMessages } from '@/lib/growth/outreach';

export const metadata: Metadata = { title: 'Meeting | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await getMeeting(id);
  if (!m) notFound();
  const messages = m.lead_id ? (await listMessages(['draft', 'approved', 'scheduled', 'sent', 'failed'], { leadId: m.lead_id, includeTest: true })).filter((x) => x.meeting_id === m.id) : [];
  const b = m.brief;
  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine: Meeting"
        title={`${m.attendee_name ?? m.attendee_email ?? 'Call'}, ${dateTime(m.starts_at)}`}
        description={m.service_name ?? undefined}
        actions={
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            {m.lead_id && <Link href={`/admin/growth/pipeline/${m.lead_id}`}>Lead</Link>}
            <Link href="/admin/growth/meetings">All meetings</Link>
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, marginBottom: 16 }}>
        <section style={adminCard}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={adminBadge('neutral')}>{m.status.replace('_', ' ')}</span>
            <span style={adminBadge('neutral')}>{m.source === 'bookings' ? 'Microsoft Bookings' : 'Added by hand'}</span>
            {m.is_test && <span style={adminBadge('neutral')}>Test</span>}
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}>{[m.attendee_name, m.attendee_email].filter(Boolean).join(', ')}</p>
          {m.previous_starts_at && <p style={{ margin: '0 0 6px', fontSize: 12, color: ADMIN_COLORS.warning }}>Moved from {dateTime(m.previous_starts_at)}</p>}
          {m.join_url && (
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <a href={m.join_url} target="_blank" rel="noopener noreferrer">
                Join link
              </a>
            </p>
          )}
          {m.customer_notes && <p style={{ margin: '0 0 12px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Their note: {m.customer_notes}</p>}
          <MeetingActions id={m.id} status={m.status} hasBrief={Boolean(b)} notes={m.notes} outcome={m.outcome} />
        </section>
        <section style={adminCard}>
          <h2 style={h2}>
            Brief {m.brief_is_mock && <MockBadge />}
          </h2>
          {!b ? (
            <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>Not prepared yet. It is made automatically two days before the call, or now with the button.</p>
          ) : (
            <dl style={{ margin: 0, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m.brief_is_mock && <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.warning }}>Sample text from the mock provider, not a real brief.</p>}
              <div>
                <dt style={{ fontWeight: 700 }}>Company</dt>
                <dd style={{ margin: 0 }}>{b.company}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Trigger</dt>
                <dd style={{ margin: 0 }}>{b.trigger}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Activity so far</dt>
                <dd style={{ margin: 0 }}>{b.activity}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Requirement and size</dt>
                <dd style={{ margin: 0 }}>{b.requirement}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Likely services</dt>
                <dd style={{ margin: 0 }}>{b.likely_services.map(serviceLabel).join(', ')}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Open questions</dt>
                <dd style={{ margin: 0 }}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {b.open_questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Recommended next action</dt>
                <dd style={{ margin: 0 }}>{b.next_action}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
      {messages.length > 0 && (
        <section style={adminCard}>
          <h2 style={h2}>Recap and rebooking emails</h2>
          {messages.map((x) => (
            <MessageCard key={x.id} m={x} graphLive={graphMailConfigured()} />
          ))}
        </section>
      )}
    </>
  );
}
