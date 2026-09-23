'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminInput, adminTextarea } from '@/lib/admin/styles';
import { GROWTH_SERVICES, PIPELINE_STAGES } from '@/lib/growth/model';
import { VALUE_BANDS } from '@/lib/growth/outreachModel';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

/** Moves a lead to another stage. Lost asks for the reason. */
export function StageMover({ leadId, stage }: { leadId: string; stage: string }) {
  const [next, setNext] = useState(stage);
  const [reason, setReason] = useState('');
  const { busy, notice, run } = useAction();
  const save = () =>
    run('stage', async () => {
      await sendJson('PATCH', `/api/admin/growth/leads/${leadId}`, next === 'lost' ? { stage: next, lost_reason: reason } : { stage: next });
      return 'Moved.';
    });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <select aria-label="Stage" value={next} onChange={(e) => setNext(e.target.value)} style={{ ...adminInput, padding: '4px 8px', fontSize: 12 }}>
        {PIPELINE_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {next === 'lost' && next !== stage && <input aria-label="Lost reason" placeholder="Why it was lost" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...adminInput, padding: '4px 8px', fontSize: 12 }} />}
      {next !== stage && (
        <button type="button" disabled={busy !== null || (next === 'lost' && reason.trim().length < 3)} onClick={save} style={{ fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}>
          Move
        </button>
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}

type Opp = { id: string; service: string; value_band: string; expected_close: string | null; status: string; lost_reason: string | null; notes: string | null };

/** Opens or edits one opportunity on a lead. */
export function OpportunityForm({ leadId, initial, defaultService }: { leadId: string; initial?: Opp; defaultService?: string | null }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ service: initial?.service ?? defaultService ?? GROWTH_SERVICES[0].value, value_band: initial?.value_band ?? 'unknown', expected_close: initial?.expected_close ?? '', status: initial?.status ?? 'open', lost_reason: initial?.lost_reason ?? '', notes: initial?.notes ?? '' });
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  if (!open) return <GhostButton onClick={() => setOpen(true)}>{initial ? 'Edit' : 'Open an opportunity'}</GhostButton>;
  return (
    <div style={{ width: '100%' }}>
      <div style={grid}>
        <Field label="Service">
          <select value={v.service} onChange={set('service')} style={adminInput}>
            {GROWTH_SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected fee">
          <select value={v.value_band} onChange={set('value_band')} style={adminInput}>
            {VALUE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected close">
          <input type="date" value={v.expected_close} onChange={set('expected_close')} style={adminInput} />
        </Field>
        <Field label="Status">
          <select value={v.status} onChange={set('status')} style={adminInput}>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </Field>
        {v.status === 'lost' && (
          <Field label="Lost reason (required)">
            <input value={v.lost_reason} onChange={set('lost_reason')} style={adminInput} />
          </Field>
        )}
      </div>
      <Field label="Notes" style={{ marginTop: 10 }}>
        <textarea value={v.notes} onChange={set('notes')} style={{ ...adminTextarea, minHeight: 60 }} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <PrimaryButton
          disabled={busy !== null || (v.status === 'lost' && v.lost_reason.trim().length < 3)}
          onClick={() =>
            run('save', async () => {
              await sendJson('POST', `/api/admin/growth/leads/${leadId}/opportunities`, { ...v, id: initial?.id, expected_close: v.expected_close || null });
              setOpen(false);
              return 'Saved.';
            })
          }
        >
          Save opportunity
        </PrimaryButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

/** Adds a task, or ticks one off. */
export function TaskAdd({ leadId }: { leadId: string }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const { busy, notice, run } = useAction();
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="New task" style={{ flex: 2, minWidth: 200 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={adminInput} />
        </Field>
        <Field label="Due" style={{ flex: 1, minWidth: 140 }}>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={adminInput} />
        </Field>
        <PrimaryButton
          disabled={busy !== null || !title.trim()}
          onClick={() =>
            run('add', async () => {
              await sendJson('POST', '/api/admin/growth/tasks', { lead_id: leadId, title, due_date: due || null });
              setTitle('');
              setDue('');
              return 'Task added.';
            })
          }
        >
          Add task
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function TaskTick({ id, done, title, due }: { id: string; done: boolean; title: string; due: string | null }) {
  const { busy, run } = useAction();
  const overdue = !done && due && due < new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? ADMIN_COLORS.textMuted : ADMIN_COLORS.textBody }}>
      <input type="checkbox" checked={done} disabled={busy !== null} onChange={(e) => run('tick', async () => void (await sendJson('PATCH', `/api/admin/growth/tasks/${id}`, { done: e.target.checked })))} />
      {title}
      {due && <span style={{ fontSize: 12, color: overdue ? ADMIN_COLORS.danger : ADMIN_COLORS.textMuted }}>due {due}</span>}
    </label>
  );
}

/** Marks that the lead asked to meet: always Hot, unless under the minimum. */
export function MeetingRequestToggle({ leadId, value }: { leadId: string; value: boolean }) {
  const { busy, notice, run } = useAction();
  return (
    <div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input type="checkbox" checked={value} disabled={busy !== null} onChange={(e) => run('meet', async () => (await sendJson('PATCH', `/api/admin/growth/leads/${leadId}`, { meeting_requested: e.target.checked }), 'Saved; the Lead Score is updated.'))} />
        Asked for a meeting
      </label>
      <NoticeLine notice={notice} />
    </div>
  );
}
