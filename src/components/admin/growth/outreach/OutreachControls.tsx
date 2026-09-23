'use client';

import { ADMIN_COLORS, adminBadge } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

/** Draft buttons for one lead in the queue. */
export function DraftButtons({ leadId, email, blocked }: { leadId: string; email: boolean; blocked: boolean }) {
  const { busy, notice, run } = useAction();
  const draft = (channel: 'email' | 'linkedin') =>
    run(channel, async () => {
      const r = await sendJson<{ message: { is_mock_ai: boolean } }>('POST', '/api/admin/growth/outreach/drafts', { lead_id: leadId, channel });
      return r.message.is_mock_ai ? 'Mock draft added below (no Anthropic key is set).' : 'Draft added below for your approval.';
    });
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <PrimaryButton disabled={busy !== null || blocked || !email} onClick={() => draft('email')}>
          {busy === 'email' ? 'Drafting' : 'Draft email'}
        </PrimaryButton>
        <GhostButton disabled={busy !== null || blocked} onClick={() => draft('linkedin')}>
          {busy === 'linkedin' ? 'Drafting' : 'Draft LinkedIn'}
        </GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

/** The daily jobs, run by hand. */
export function OutreachJobs({ graphLive, paused }: { graphLive: boolean; paused: boolean }) {
  const { busy, notice, run } = useAction();
  const job = (j: 'replies' | 'follow_ups' | 'send_due') => run(j, async () => (await sendJson<{ message: string }>('POST', '/api/admin/growth/outreach/run', { job: j })).message);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={adminBadge(graphLive ? 'success' : 'warning')}>{graphLive ? 'Sending from your mailbox' : 'Mail in mock mode: nothing is delivered'}</span>
        {paused && <span style={adminBadge('danger')}>Sending paused in Settings</span>}
        <GhostButton disabled={busy !== null} onClick={() => job('replies')}>
          Check replies
        </GhostButton>
        <GhostButton disabled={busy !== null} onClick={() => job('follow_ups')}>
          Draft due follow-ups
        </GhostButton>
        <GhostButton disabled={busy !== null} onClick={() => job('send_due')}>
          Send scheduled now
        </GhostButton>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>These also run each morning at 09:00 Riyadh time.</p>
      <NoticeLine notice={notice} />
    </div>
  );
}
