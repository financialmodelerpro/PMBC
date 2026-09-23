import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AddMeeting, SyncBookings } from '@/components/admin/growth/meetings/MeetingControls';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { growthDb } from '@/lib/growth/db';
import { dateTime } from '@/lib/growth/format';
import { graphBookingsConfigured } from '@/lib/growth/graph';
import { listMeetings, meetingsReady, type Meeting } from '@/lib/growth/meetings';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Meetings | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TONE = { scheduled: 'success', rescheduled: 'warning', cancelled: 'neutral', completed: 'neutral', no_show: 'danger' } as const;

function Table({ rows, empty }: { rows: Meeting[]; empty: string }) {
  if (!rows.length) return <p style={{ padding: '0 20px 16px', margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>{empty}</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={adminTable}>
        <thead style={adminThead}>
          <tr>
            <th style={adminTh}>When (Riyadh)</th>
            <th style={adminTh}>Who</th>
            <th style={adminTh}>Status</th>
            <th style={adminTh}>Brief</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>
                <Link href={`/admin/growth/meetings/${m.id}`}>{dateTime(m.starts_at)}</Link>
                {m.previous_starts_at && <div style={{ color: ADMIN_COLORS.textMicro }}>was {dateTime(m.previous_starts_at)}</div>}
              </td>
              <td style={{ ...adminTd, fontSize: 13 }}>
                {m.attendee_name ?? m.attendee_email ?? 'Unknown'}
                <div style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>{m.source === 'bookings' ? 'Microsoft Bookings' : 'Added by hand'}</div>
              </td>
              <td style={adminTd}>
                <span style={adminBadge(TONE[m.status])}>{m.status.replace('_', ' ')}</span>
                {m.is_test && <span style={{ ...adminBadge('neutral'), marginLeft: 4 }}>Test</span>}
              </td>
              <td style={{ ...adminTd, fontSize: 12 }}>{m.brief ? (m.brief_is_mock ? 'Mock brief' : 'Ready') : 'Not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GrowthMeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('meetings');
  const includeTest = (await searchParams).test === '1';
  const ready = await meetingsReady();
  if (!ready) {
    return (
      <>
        <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
        <MigrationNotice migration="091_growth_meetings.sql" table="growth_meetings" effect="Calls cannot be synced or added until then." />
      </>
    );
  }
  const now = new Date();
  const [upcoming, past, leadRows] = await Promise.all([
    listMeetings({ includeTest, from: new Date(now.getTime() - 3 * 3_600_000) }),
    listMeetings({ includeTest, to: new Date(now.getTime() - 3 * 3_600_000), from: new Date(now.getTime() - 90 * 86_400_000) }),
    growthDb().from('growth_leads').select('id, title').eq('is_test', false).not('stage', 'in', '(won,lost)').order('title').limit(1000),
  ]);
  const needsNotes = past.filter((m) => ['scheduled', 'rescheduled'].includes(m.status));
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <section style={{ ...adminCard, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ ...adminBadge(graphBookingsConfigured() ? 'success' : 'warning'), alignSelf: 'flex-start' }}>{graphBookingsConfigured() ? 'Microsoft Bookings connected' : 'Bookings in mock mode: sync is a preview'}</span>
        <SyncBookings />
        <AddMeeting leads={(leadRows.data ?? []) as { id: string; title: string }[]} />
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>Bookings sync and briefs for the next two days also run each morning at 09:00 Riyadh time. <Link href={`/admin/growth/meetings${includeTest ? '' : '?test=1'}`}>{includeTest ? 'Hide test rows' : 'Include test rows'}</Link></p>
      </section>
      {needsNotes.length > 0 && (
        <section style={{ ...adminCard, padding: 0, marginBottom: 16 }}>
          <h2 style={{ margin: 0, padding: '14px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.danger }}>Past calls needing notes ({needsNotes.length})</h2>
          <Table rows={needsNotes} empty="" />
        </section>
      )}
      <section style={{ ...adminCard, padding: 0, marginBottom: 16 }}>
        <h2 style={{ margin: 0, padding: '14px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Upcoming</h2>
        <Table rows={upcoming} empty="No calls booked." />
      </section>
      <section style={{ ...adminCard, padding: 0 }}>
        <h2 style={{ margin: 0, padding: '14px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Last 90 days</h2>
        <Table rows={[...past].reverse()} empty="No past calls." />
      </section>
    </>
  );
}
