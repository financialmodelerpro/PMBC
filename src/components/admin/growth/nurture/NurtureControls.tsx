'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminInput, adminTextarea } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { Field, GhostButton, MockBadge, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

const url = '/api/admin/growth/nurture';

export function NurtureRunButtons() {
  const [preview, setPreview] = useState<{ contact: string; email: string | null; step: number; subject: string }[] | null>(null);
  const { busy, notice, run } = useAction();
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GhostButton disabled={busy !== null} onClick={() => run('sync', async () => (await sendJson<{ message: string }>('POST', url, { action: 'sync' })).message)}>
          Sync to Brevo
        </GhostButton>
        <GhostButton
          disabled={busy !== null}
          onClick={() =>
            run('run', async () => {
              const r = await sendJson<{ message: string; mode: string; preview: { contact: string; email: string | null; step: number; subject: string }[] }>('POST', url, { action: 'run' });
              setPreview(r.mode === 'real' ? null : r.preview);
              return r.message;
            })
          }
        >
          Run the sequence now
        </GhostButton>
      </div>
      <NoticeLine notice={notice} />
      {preview && preview.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {preview.map((p, i) => (
            <li key={i}>
              <MockBadge /> Step {p.step} to {p.contact} ({p.email}): {p.subject}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Step = { id: string; step: number; delay_days: number; subject: string; body: string; link_path: string | null; status: string; approved_by_name: string | null };

export function StepEditor({ step, nextStep }: { step?: Step; nextStep: number }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ step: String(step?.step ?? nextStep), delay_days: String(step?.delay_days ?? 7), subject: step?.subject ?? '', body: step?.body ?? '', link_path: step?.link_path ?? '' });
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <div>
      {step && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>
            Step {step.step}: {step.subject}
          </strong>
          <span style={adminBadge(step.status === 'approved' ? 'success' : 'warning')}>{step.status}</span>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{step.delay_days} days after the previous</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <GhostButton onClick={() => setOpen(!open)}>{step ? 'Edit' : 'Add a step'}</GhostButton>
        {step && step.status !== 'approved' && (
          <PrimaryButton disabled={busy !== null} onClick={() => run('approve', async () => (await sendJson('POST', url, { action: 'approve_step', id: step.id }), 'Approved.'))}>
            Approve
          </PrimaryButton>
        )}
        {step && (
          <GhostButton danger disabled={busy !== null} onClick={() => run('archive', async () => (await sendJson('POST', url, { action: 'archive_step', id: step.id }), 'Archived.'))}>
            Archive
          </GhostButton>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={grid}>
            <Field label="Step">
              <input value={v.step} onChange={set('step')} style={adminInput} inputMode="numeric" />
            </Field>
            <Field label="Days after the previous">
              <input value={v.delay_days} onChange={set('delay_days')} style={adminInput} inputMode="numeric" />
            </Field>
            <Field label="Links to (site path)">
              <input value={v.link_path} onChange={set('link_path')} style={adminInput} placeholder="/insights" />
            </Field>
          </div>
          <Field label="Subject" style={{ marginTop: 10 }}>
            <input value={v.subject} onChange={set('subject')} style={adminInput} />
          </Field>
          <Field label="Body" hint="[First name] and [Link] are filled when sent. The opt-out line is added to every email." style={{ marginTop: 10 }}>
            <textarea value={v.body} onChange={set('body')} style={{ ...adminTextarea, minHeight: 160 }} />
          </Field>
          <div style={{ marginTop: 10 }}>
            <PrimaryButton
              disabled={busy !== null}
              onClick={() =>
                run('save', async () => {
                  await sendJson('POST', url, { action: 'save_step', id: step?.id ?? null, step: { step: Number(v.step), delay_days: Number(v.delay_days), subject: v.subject, body: v.body, link_path: v.link_path || null } });
                  setOpen(false);
                  return 'Saved as a draft: approve it before it is sent.';
                })
              }
            >
              Save step
            </PrimaryButton>
          </div>
        </div>
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}

type Magnet = { id: string; title: string; description: string | null; url: string; email_subject: string; email_body: string; status: string };

export function MagnetEditor({ magnet, contacts }: { magnet?: Magnet; contacts: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: magnet?.title ?? '', description: magnet?.description ?? '', url: magnet?.url ?? '', email_subject: magnet?.email_subject ?? '', email_body: magnet?.email_body ?? '' });
  const [to, setTo] = useState('');
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <div>
      {magnet && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>{magnet.title}</strong>
          <span style={adminBadge(magnet.status === 'approved' ? 'success' : 'warning')}>{magnet.status}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <GhostButton onClick={() => setOpen(!open)}>{magnet ? 'Edit' : 'Add a lead magnet'}</GhostButton>
        {magnet && magnet.status !== 'approved' && (
          <PrimaryButton disabled={busy !== null} onClick={() => run('approve', async () => (await sendJson('POST', url, { action: 'approve_magnet', id: magnet.id }), 'Approved.'))}>
            Approve
          </PrimaryButton>
        )}
        {magnet && magnet.status === 'approved' && (
          <>
            <select value={to} onChange={(e) => setTo(e.target.value)} style={{ ...adminInput, width: 240 }} aria-label="Send to">
              <option value="">Send to an opted-in contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <PrimaryButton disabled={busy !== null || !to} onClick={() => run('send', async () => (await sendJson<{ preview: string }>('POST', url, { action: 'send_magnet', contact_id: to, magnet_id: magnet.id })).preview)}>
              Send
            </PrimaryButton>
          </>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={grid}>
            <Field label="Title">
              <input value={v.title} onChange={set('title')} style={adminInput} />
            </Field>
            <Field label="Link to the file or page" hint="https:// or a site path">
              <input value={v.url} onChange={set('url')} style={adminInput} />
            </Field>
          </div>
          <Field label="Description" style={{ marginTop: 10 }}>
            <input value={v.description} onChange={set('description')} style={adminInput} />
          </Field>
          <Field label="Email subject" style={{ marginTop: 10 }}>
            <input value={v.email_subject} onChange={set('email_subject')} style={adminInput} />
          </Field>
          <Field label="Email body" hint="[First name] and [Link] are filled when sent" style={{ marginTop: 10 }}>
            <textarea value={v.email_body} onChange={set('email_body')} style={{ ...adminTextarea, minHeight: 120 }} />
          </Field>
          <div style={{ marginTop: 10 }}>
            <PrimaryButton
              disabled={busy !== null}
              onClick={() =>
                run('save', async () => {
                  await sendJson('POST', url, { action: 'save_magnet', id: magnet?.id ?? null, magnet: { ...v, description: v.description || null } });
                  setOpen(false);
                  return 'Saved as a draft: approve it before it is sent.';
                })
              }
            >
              Save lead magnet
            </PrimaryButton>
          </div>
        </div>
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}

/** Subscribe an opted-in contact to nurture, or unsubscribe them. */
export function NurtureToggle({ contactId, status, optedIn }: { contactId: string; status: string; optedIn: boolean }) {
  const { busy, notice, run } = useAction();
  if (status === 'subscribed')
    return (
      <div>
        <GhostButton disabled={busy !== null} onClick={() => run('unsub', async () => (await sendJson('POST', url, { action: 'unsubscribe', contact_id: contactId, reason: 'Removed by hand' }), 'Unsubscribed.'))}>
          Unsubscribe from nurture
        </GhostButton>
        <NoticeLine notice={notice} />
      </div>
    );
  if (!optedIn) return null;
  return (
    <div>
      <GhostButton disabled={busy !== null} onClick={() => run('sub', async () => (await sendJson('POST', url, { action: 'subscribe', contact_id: contactId }), 'Subscribed.'))}>
        Subscribe to nurture
      </GhostButton>
      <NoticeLine notice={notice} />
    </div>
  );
}
