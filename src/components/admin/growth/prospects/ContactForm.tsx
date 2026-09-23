'use client';

import { useState } from 'react';

import { adminInput } from '@/lib/admin/styles';
import { CONSENT_STATUSES } from '@/lib/growth/model';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

export type ContactValues = { full_name: string; role_title: string; email: string; phone: string; linkedin_url: string; is_decision_maker: boolean; consent_status: string; consent_source: string; notes: string };
export const emptyContact: ContactValues = { full_name: '', role_title: '', email: '', phone: '', linkedin_url: '', is_decision_maker: false, consent_status: 'unknown', consent_source: '', notes: '' };

/** Adds a contact to a company, or edits one. */
export function ContactForm({ companyId, contactId, initial, onDone }: { companyId: string; contactId?: string; initial: ContactValues; onDone?: () => void }) {
  const [v, setV] = useState(initial);
  const { busy, notice, run } = useAction();
  const set = (k: keyof ContactValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = () =>
    run('save', async () => {
      if (contactId) await sendJson('PATCH', `/api/admin/growth/contacts/${contactId}`, v);
      else await sendJson('POST', `/api/admin/growth/companies/${companyId}/contacts`, v);
      if (!contactId) setV(emptyContact);
      onDone?.();
      return contactId ? 'Contact saved.' : 'Contact added.';
    });

  return (
    <div>
      <div style={grid}>
        <Field label="Name">
          <input value={v.full_name} onChange={set('full_name')} style={adminInput} />
        </Field>
        <Field label="Job title">
          <input value={v.role_title} onChange={set('role_title')} style={adminInput} />
        </Field>
        <Field label="Email">
          <input value={v.email} onChange={set('email')} style={adminInput} type="email" />
        </Field>
        <Field label="Phone">
          <input value={v.phone} onChange={set('phone')} style={adminInput} />
        </Field>
        <Field label="LinkedIn">
          <input value={v.linkedin_url} onChange={set('linkedin_url')} style={adminInput} placeholder="https://" />
        </Field>
        <Field label="Consent">
          <select value={v.consent_status} onChange={set('consent_status')} style={adminInput}>
            {CONSENT_STATUSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Consent source" hint="Where the consent came from">
          <input value={v.consent_source} onChange={set('consent_source')} style={adminInput} />
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={v.is_decision_maker} onChange={(e) => setV({ ...v, is_decision_maker: e.target.checked })} /> Decision-maker
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <PrimaryButton onClick={save} disabled={busy !== null || !v.full_name.trim()}>
          {busy ? 'Saving' : contactId ? 'Save contact' : 'Add contact'}
        </PrimaryButton>
        {onDone && <GhostButton onClick={onDone}>Cancel</GhostButton>}
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
