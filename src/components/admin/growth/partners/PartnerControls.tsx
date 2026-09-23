'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminInput, adminTextarea } from '@/lib/admin/styles';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

const TYPES = [
  { value: 'referral_partner', label: 'Referral partner' },
  { value: 'past_client', label: 'Past client' },
  { value: 'bank', label: 'Bank or lender' },
  { value: 'law_firm', label: 'Law firm' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'developer', label: 'Developer' },
  { value: 'other', label: 'Other' },
];
const OUTCOMES = [
  { value: 'pending', label: 'Pending' },
  { value: 'meeting', label: 'Meeting held' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'no_response', label: 'No response' },
];

type P = { id: string; name: string; type: string; organisation: string | null; email: string | null; phone: string | null; linkedin_url: string | null; notes: string | null; status: string; checkin_every_days: number | null };

export function PartnerForm({ partner, defaultDays }: { partner?: P; defaultDays: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: partner?.name ?? '', type: partner?.type ?? 'referral_partner', organisation: partner?.organisation ?? '', email: partner?.email ?? '', phone: partner?.phone ?? '', linkedin_url: partner?.linkedin_url ?? '', notes: partner?.notes ?? '', status: partner?.status ?? 'active', days: partner?.checkin_every_days ? String(partner.checkin_every_days) : '' });
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  if (!open) return <GhostButton onClick={() => setOpen(true)}>{partner ? 'Edit' : 'Add a partner or past client'}</GhostButton>;
  return (
    <div>
      <div style={grid}>
        <Field label="Name">
          <input value={v.name} onChange={set('name')} style={adminInput} />
        </Field>
        <Field label="Type">
          <select value={v.type} onChange={set('type')} style={adminInput}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Organisation">
          <input value={v.organisation} onChange={set('organisation')} style={adminInput} />
        </Field>
        <Field label="Email">
          <input value={v.email} onChange={set('email')} style={adminInput} type="email" />
        </Field>
        <Field label="Phone">
          <input value={v.phone} onChange={set('phone')} style={adminInput} />
        </Field>
        <Field label="Check in every (days)" hint={`Blank uses the default, ${defaultDays}`}>
          <input value={v.days} onChange={set('days')} style={adminInput} inputMode="numeric" />
        </Field>
        <Field label="Status">
          <select value={v.status} onChange={set('status')} style={adminInput}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>
      <Field label="Notes" style={{ marginTop: 10 }}>
        <textarea value={v.notes} onChange={set('notes')} style={{ ...adminTextarea, minHeight: 60 }} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <PrimaryButton
          disabled={busy !== null || !v.name.trim()}
          onClick={() =>
            run('save', async () => {
              const r = await sendJson<{ partner: { id: string } }>('POST', '/api/admin/growth/partners', { id: partner?.id ?? null, name: v.name, type: v.type, organisation: v.organisation || null, email: v.email || '', phone: v.phone || null, linkedin_url: v.linkedin_url || null, notes: v.notes || null, status: v.status, checkin_every_days: v.days ? Number(v.days) : null });
              setOpen(false);
              if (!partner) router.push(`/admin/growth/partners/${r.partner.id}`);
              return 'Saved.';
            })
          }
        >
          Save
        </PrimaryButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function CheckinButton({ id }: { id: string }) {
  const [note, setNote] = useState('');
  const { busy, notice, run } = useAction();
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Check-in note" style={{ flex: 1, minWidth: 220 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} style={adminInput} placeholder="What you talked about" />
        </Field>
        <PrimaryButton
          disabled={busy !== null}
          onClick={() =>
            run('checkin', async () => {
              const r = await sendJson<{ partner: { next_checkin_due: string } }>('POST', `/api/admin/growth/partners/${id}`, { action: 'checkin', note: note || null });
              setNote('');
              return `Logged. Next check-in ${r.partner.next_checkin_due}.`;
            })
          }
        >
          Log a check-in
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

type Intro = { id: string; company_name: string; introduced_on: string; direction: string; outcome: string; notes: string | null; lead_id: string | null };

export function IntroForm({ partnerId, intro }: { partnerId: string; intro?: Intro }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ company_name: intro?.company_name ?? '', introduced_on: intro?.introduced_on ?? new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10), direction: intro?.direction ?? 'to_us', outcome: intro?.outcome ?? 'pending', notes: intro?.notes ?? '', open_lead: !intro });
  const { busy, notice, run } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  if (!open) return <GhostButton onClick={() => setOpen(true)}>{intro ? 'Update' : 'Record an introduction'}</GhostButton>;
  return (
    <div>
      <div style={grid}>
        <Field label="Company">
          <input value={v.company_name} onChange={set('company_name')} style={adminInput} />
        </Field>
        <Field label="Date">
          <input type="date" value={v.introduced_on} onChange={set('introduced_on')} style={adminInput} />
        </Field>
        <Field label="Direction">
          <select value={v.direction} onChange={set('direction')} style={adminInput}>
            <option value="to_us">They introduced a prospect to us</option>
            <option value="from_us">We introduced someone to them</option>
          </select>
        </Field>
        <Field label="Outcome">
          <select value={v.outcome} onChange={set('outcome')} style={adminInput}>
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes" style={{ marginTop: 10 }}>
        <input value={v.notes} onChange={set('notes')} style={adminInput} />
      </Field>
      {!intro && v.direction === 'to_us' && (
        <label style={{ display: 'flex', gap: 6, fontSize: 13, marginTop: 8 }}>
          <input type="checkbox" checked={v.open_lead} onChange={(e) => setV({ ...v, open_lead: e.target.checked })} /> Open a lead with this partner as its referral source
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <PrimaryButton
          disabled={busy !== null || !v.company_name.trim()}
          onClick={() =>
            run('save', async () => {
              await sendJson('POST', `/api/admin/growth/partners/${partnerId}`, { action: 'intro', id: intro?.id ?? null, intro: { company_name: v.company_name, introduced_on: v.introduced_on, direction: v.direction, outcome: v.outcome, notes: v.notes || null, lead_id: intro?.lead_id ?? null, open_lead: v.open_lead } });
              setOpen(false);
              return 'Saved.';
            })
          }
        >
          Save introduction
        </PrimaryButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function ReferralSetter({ leadId, partners, partnerId, source }: { leadId: string; partners: { id: string; name: string }[]; partnerId: string | null; source: string | null }) {
  const [p, setP] = useState(partnerId ?? '');
  const [s, setS] = useState(source ?? '');
  const { busy, notice, run } = useAction();
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Referral partner" style={{ minWidth: 200 }}>
          <select value={p} onChange={(e) => setP(e.target.value)} style={adminInput}>
            <option value="">None</option>
            {partners.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referral source" style={{ flex: 1, minWidth: 200 }}>
          <input value={s} onChange={(e) => setS(e.target.value)} style={adminInput} placeholder="Who or what referred them" />
        </Field>
        <GhostButton disabled={busy !== null} onClick={() => run('ref', async () => (await sendJson('POST', `/api/admin/growth/leads/${leadId}/referral`, { partner_id: p || null, source: s || null }), 'Saved.'))}>
          Save referral
        </GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
