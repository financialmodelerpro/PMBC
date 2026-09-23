'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminInput, adminTextarea } from '@/lib/admin/styles';
import { SITE_HREF } from '@/lib/brand/letterhead';
import { dateTime } from '@/lib/growth/format';
import { unresolvedPlaceholders } from '@/lib/growth/outreachModel';

import { sendJson } from '../ui/client';
import { Field, GhostButton, MockBadge, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

export type MessageView = {
  id: string;
  channel: 'email' | 'linkedin';
  kind: string;
  sequence_step: number;
  status: string;
  subject: string | null;
  body: string;
  link_path: string | null;
  is_mock_ai: boolean;
  is_test: boolean;
  edited: boolean;
  approved_by_name: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  send_mode: string | null;
  replied_at: string | null;
  rejected_reason: string | null;
  cancelled_reason: string | null;
  error: string | null;
  lead_id: string | null;
  leadTitle: string | null;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  signalSummary: string | null;
  signalUrl: string | null;
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = { draft: 'warning', approved: 'success', scheduled: 'neutral', sent: 'success', failed: 'danger', rejected: 'neutral', cancelled: 'neutral' };

/** One outreach message with every action its status allows. */
export function MessageCard({ m, graphLive }: { m: MessageView; graphLive: boolean }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(m.subject ?? '');
  const [body, setBody] = useState(m.body);
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState<'reject' | 'cancel' | 'reply' | null>(null);
  const { busy, notice, run } = useAction();
  const url = `/api/admin/growth/messages/${m.id}`;
  const act = (body: Record<string, unknown>, done: string) =>
    run(String(body.action), async () => {
      const r = await sendJson<{ message: { status: string; scheduled_for: string | null; send_mode: string | null } }>('POST', url, body);
      setAsking(null);
      setReason('');
      if (r.message.status === 'scheduled') return `Scheduled for ${dateTime(r.message.scheduled_for)} (Riyadh): outside the sending window or over today's cap.`;
      if (r.message.status === 'sent' && r.message.send_mode === 'mock') return 'Recorded as sent in mock mode: nothing was delivered.';
      return done;
    });
  const left = unresolvedPlaceholders(`${subject}\n${body}`);

  return (
    <article style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <span style={adminBadge(STATUS_TONE[m.status] ?? 'neutral')}>{m.status}</span>
        <span style={adminBadge('neutral')}>
          {m.channel === 'email' ? 'Email' : 'LinkedIn'} {m.kind === 'follow_up' ? `follow-up ${m.sequence_step}` : m.kind.replace('_', ' ')}
        </span>
        {m.is_mock_ai && <MockBadge />}
        {m.send_mode === 'mock' && <span style={adminBadge('warning')}>Mock send: not delivered</span>}
        {m.is_test && <span style={adminBadge('neutral')}>Test</span>}
        {m.replied_at && <span style={adminBadge('success')}>Replied {dateTime(m.replied_at)}</span>}
        {m.lead_id ? (
          <Link href={`/admin/growth/pipeline/${m.lead_id}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {m.companyName ?? m.leadTitle}
          </Link>
        ) : (
          <span style={{ fontSize: 13 }}>{m.companyName}</span>
        )}
        <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          to {m.contactName}
          {m.channel === 'email' && m.contactEmail ? ` <${m.contactEmail}>` : ''}
        </span>
      </div>
      {m.signalSummary && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          Cites: {m.signalSummary}{' '}
          {m.signalUrl && (
            <a href={m.signalUrl} target="_blank" rel="noopener noreferrer nofollow">
              evidence
            </a>
          )}
          {m.link_path ? `. Links to ${m.link_path}` : ''}
        </p>
      )}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {m.channel === 'email' && (
            <Field label="Subject">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={adminInput} />
            </Field>
          )}
          <Field label="Message" hint="[Link] becomes the tracked link. The opt-out line is added to every email when it is sent.">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ ...adminTextarea, minHeight: 200 }} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryButton
              disabled={busy !== null}
              onClick={() =>
                run('save', async () => {
                  await sendJson('PATCH', url, { subject, body });
                  setEditing(false);
                  return m.status === 'draft' ? 'Saved.' : 'Saved. It needs approving again.';
                })
              }
            >
              Save
            </PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          </div>
        </div>
      ) : (
        <div style={{ background: ADMIN_COLORS.altBg, border: `1px solid ${ADMIN_COLORS.borderSoft}`, borderRadius: 8, padding: 12, fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {m.subject && <div style={{ fontWeight: 700, marginBottom: 8 }}>{m.subject}</div>}
          {m.body}
        </div>
      )}
      {m.status === 'draft' && left.length > 0 && !editing && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.warning }}>Fill in before approving: {left.join(', ')}</p>}
      {m.scheduled_for && m.status === 'scheduled' && <p style={{ margin: '6px 0 0', fontSize: 12 }}>Scheduled for {dateTime(m.scheduled_for)} Riyadh time.</p>}
      {m.sent_at && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Sent {dateTime(m.sent_at)}{m.send_mode === 'manual' ? ' by hand' : ''}.</p>}
      {(m.rejected_reason || m.cancelled_reason || m.error) && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>{m.rejected_reason ?? m.cancelled_reason ?? m.error}</p>}

      {!editing && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {['draft', 'approved', 'scheduled'].includes(m.status) && <GhostButton onClick={() => setEditing(true)}>Edit</GhostButton>}
          {m.status === 'draft' && (
            <PrimaryButton disabled={busy !== null || left.length > 0} onClick={() => act({ action: 'approve' }, 'Approved.')}>
              Approve
            </PrimaryButton>
          )}
          {m.channel === 'email' && ['approved', 'scheduled'].includes(m.status) && (
            <PrimaryButton disabled={busy !== null || (graphLive && m.is_mock_ai)} onClick={() => act({ action: 'send' }, graphLive ? 'Sent from your mailbox.' : 'Recorded.')}>
              {graphLive ? 'Send now' : 'Send (mock)'}
            </PrimaryButton>
          )}
          {m.channel === 'linkedin' && m.status === 'approved' && (
            <>
              <GhostButton
                onClick={() =>
                  run('copy', async () => {
                    await navigator.clipboard.writeText(m.body.split('[Link]').join(`${SITE_HREF}${m.link_path ?? '/'}`));
                    return 'Copied. Send it on LinkedIn, then mark it sent.';
                  }, { refresh: false })
                }
              >
                Copy text
              </GhostButton>
              <PrimaryButton disabled={busy !== null} onClick={() => act({ action: 'mark_sent' }, 'Marked as sent on LinkedIn.')}>
                Mark sent
              </PrimaryButton>
            </>
          )}
          {m.status === 'sent' && !m.replied_at && <GhostButton onClick={() => setAsking('reply')}>Mark replied</GhostButton>}
          {['draft', 'approved', 'scheduled'].includes(m.status) && (
            <GhostButton danger onClick={() => setAsking(m.status === 'draft' ? 'reject' : 'cancel')}>
              {m.status === 'draft' ? 'Reject' : 'Cancel'}
            </GhostButton>
          )}
        </div>
      )}
      {asking && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginTop: 8 }}>
          <Field label={asking === 'reply' ? 'What they said (optional)' : 'Reason (required)'} style={{ flex: 1, minWidth: 220 }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={adminInput} />
          </Field>
          <PrimaryButton
            disabled={busy !== null || (asking !== 'reply' && reason.trim().length < 3)}
            onClick={() => act(asking === 'reply' ? { action: 'mark_replied', note: reason || undefined } : { action: asking, reason }, asking === 'reply' ? 'Reply recorded: the sequence has stopped.' : 'Done.')}
          >
            Confirm
          </PrimaryButton>
          <GhostButton onClick={() => setAsking(null)}>Back</GhostButton>
        </div>
      )}
      {graphLive && m.is_mock_ai && ['approved', 'scheduled'].includes(m.status) && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>Written by the mock AI: it can never be sent for real. Reject it and draft again.</p>}
      <NoticeLine notice={notice} />
    </article>
  );
}
