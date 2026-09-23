'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminInput, adminTextarea } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { Field, GhostButton, MockBadge, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

type Preview = { id: string; start: string; customerName: string | null; customerEmail: string | null; serviceName: string | null; cancelled: boolean };

export function SyncBookings() {
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const { busy, notice, run } = useAction();
  return (
    <div>
      <PrimaryButton
        disabled={busy !== null}
        onClick={() =>
          run('sync', async () => {
            const r = await sendJson<{ mode: string; message: string; preview: Preview[] }>('POST', '/api/admin/growth/meetings', { action: 'sync' });
            setPreview(r.mode === 'mock_preview' ? r.preview : null);
            return r.message;
          })
        }
      >
        {busy ? 'Syncing' : 'Sync Microsoft Bookings'}
      </PrimaryButton>
      <NoticeLine notice={notice} />
      {preview && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 13 }}>
          {preview.map((p) => (
            <li key={p.id} style={{ marginBottom: 4 }}>
              <MockBadge /> {new Date(p.start).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' })}: {p.customerName} ({p.serviceName}){p.cancelled ? ', cancelled' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AddMeeting({ leads }: { leads: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ lead_id: '', attendee_name: '', attendee_email: '', date: '', time: '10:00', minutes: '45', join_url: '' });
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  if (!open) return <GhostButton onClick={() => setOpen(true)}>Add a call by hand</GhostButton>;
  return (
    <div>
      <div style={grid}>
        <Field label="Lead">
          <select value={v.lead_id} onChange={set('lead_id')} style={adminInput}>
            <option value="">Match by attendee email</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </Field>
        {!v.lead_id && (
          <>
            <Field label="Attendee name">
              <input value={v.attendee_name} onChange={set('attendee_name')} style={adminInput} />
            </Field>
            <Field label="Attendee email">
              <input value={v.attendee_email} onChange={set('attendee_email')} style={adminInput} type="email" />
            </Field>
          </>
        )}
        <Field label="Date">
          <input type="date" value={v.date} onChange={set('date')} style={adminInput} />
        </Field>
        <Field label="Time (Riyadh)">
          <input type="time" value={v.time} onChange={set('time')} style={adminInput} />
        </Field>
        <Field label="Minutes">
          <input value={v.minutes} onChange={set('minutes')} style={adminInput} inputMode="numeric" />
        </Field>
        <Field label="Join link">
          <input value={v.join_url} onChange={set('join_url')} style={adminInput} placeholder="https://" />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <PrimaryButton
          disabled={busy !== null || !v.date || !v.time}
          onClick={() =>
            run('add', async () => {
              const start = new Date(`${v.date}T${v.time}:00+03:00`);
              const end = new Date(start.getTime() + (Number(v.minutes) || 45) * 60_000);
              await sendJson('POST', '/api/admin/growth/meetings', { action: 'create', lead_id: v.lead_id || null, attendee_name: v.attendee_name || null, attendee_email: v.attendee_email || '', starts_at: start.toISOString(), ends_at: end.toISOString(), join_url: v.join_url || null });
              setOpen(false);
              return 'Call added. The lead is now at Meeting Booked.';
            })
          }
        >
          Add call
        </PrimaryButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

const OUTCOMES = [
  { value: 'positive', label: 'Positive: next step agreed' },
  { value: 'proposal_requested', label: 'Proposal requested' },
  { value: 'needs_follow_up', label: 'Needs a follow-up' },
  { value: 'not_a_fit', label: 'Not a fit' },
  { value: 'other', label: 'Other' },
];

export function MeetingActions({ id, status, hasBrief, notes, outcome }: { id: string; status: string; hasBrief: boolean; notes: string | null; outcome: string | null }) {
  const [v, setV] = useState({ status: status === 'no_show' || status === 'completed' ? status : 'completed', notes: notes ?? '', outcome: outcome ?? 'positive', lost_reason: '' });
  const { busy, notice, run } = useAction();
  const url = `/api/admin/growth/meetings/${id}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GhostButton disabled={busy !== null} onClick={() => run('brief', async () => ((await sendJson<{ meeting: { brief_is_mock: boolean } }>('POST', url, { action: 'brief' })).meeting.brief_is_mock ? 'Mock brief prepared.' : 'Brief prepared.'))}>
          {hasBrief ? 'Prepare the brief again' : 'Prepare the brief'}
        </GhostButton>
        {status === 'completed' && (
          <GhostButton disabled={busy !== null} onClick={() => run('recap', async () => (await sendJson('POST', url, { action: 'draft', kind: 'recap' }), 'Recap drafted below for approval.'))}>
            Draft the recap email
          </GhostButton>
        )}
        {status === 'no_show' && (
          <GhostButton disabled={busy !== null} onClick={() => run('noshow', async () => (await sendJson('POST', url, { action: 'draft', kind: 'no_show' }), 'Rebooking email drafted below for approval.'))}>
            Draft a rebooking email
          </GhostButton>
        )}
      </div>
      <div style={grid}>
        <Field label="The call">
          <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} style={adminInput}>
            <option value="completed">Held</option>
            <option value="no_show">No show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        {v.status === 'completed' && (
          <Field label="Outcome">
            <select value={v.outcome} onChange={(e) => setV({ ...v, outcome: e.target.value })} style={adminInput}>
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {v.status === 'completed' && v.outcome === 'not_a_fit' && (
          <Field label="Why (required)">
            <input value={v.lost_reason} onChange={(e) => setV({ ...v, lost_reason: e.target.value })} style={adminInput} />
          </Field>
        )}
      </div>
      <Field label="Notes">
        <textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} style={{ ...adminTextarea, minHeight: 120 }} />
      </Field>
      <div>
        <PrimaryButton
          disabled={busy !== null || (v.status === 'completed' && v.outcome === 'not_a_fit' && v.lost_reason.trim().length < 3)}
          onClick={() => run('outcome', async () => (await sendJson('POST', url, { action: 'outcome', status: v.status, notes: v.notes || null, outcome: v.status === 'completed' ? v.outcome : null, lost_reason: v.lost_reason || null }), 'Saved. The lead has moved on.'))}
        >
          Save notes and outcome
        </PrimaryButton>
      </div>
      {status === 'completed' && outcome && <span style={{ ...adminBadge('success'), alignSelf: 'flex-start' }}>Recorded: {OUTCOMES.find((o) => o.value === outcome)?.label}</span>}
      <NoticeLine notice={notice} />
      <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>Recap and rebooking drafts need your approval, then send through the normal rules.</p>
    </div>
  );
}
