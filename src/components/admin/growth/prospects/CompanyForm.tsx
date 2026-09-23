'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminInput, adminTextarea } from '@/lib/admin/styles';
import { COMPANY_STATUSES, GROWTH_SERVICES, LEAD_SOURCES } from '@/lib/growth/model';

import { parseAmount, sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

export type CompanyFormValues = {
  name: string;
  website_domain: string;
  sector: string;
  city: string;
  country: string;
  description: string;
  linkedin_url: string;
  likely_service: string;
  status: string;
  notes: string;
  source: string;
  scale_sar: string;
};

export const emptyCompany: CompanyFormValues = { name: '', website_domain: '', sector: '', city: '', country: 'Saudi Arabia', description: '', linkedin_url: '', likely_service: '', status: 'new', notes: '', source: 'outbound', scale_sar: '' };

/** Creates a company (then opens it) or edits one in place. */
export function CompanyForm({ id, initial, onDone }: { id?: string; initial: CompanyFormValues; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const { busy, notice, run } = useAction();
  const set = (k: keyof CompanyFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = () =>
    run('save', async () => {
      const scale = parseAmount(v.scale_sar);
      if (Number.isNaN(scale)) throw new Error('Scale: use a number such as 450000000, 450m or 1.2bn');
      const body = { ...v, scale_sar: scale, likely_service: v.likely_service || null, source: v.source || null };
      if (id) {
        await sendJson('PATCH', `/api/admin/growth/companies/${id}`, body);
        onDone?.();
        return 'Saved. The score has been recalculated.';
      }
      const data = await sendJson<{ company: { id: string } }>('POST', '/api/admin/growth/companies', body);
      router.push(`/admin/growth/prospects/${data.company.id}`);
      return 'Created.';
    });

  return (
    <div>
      <div style={grid}>
        <Field label="Company name">
          <input value={v.name} onChange={set('name')} style={adminInput} />
        </Field>
        <Field label="Website domain" hint="Used to catch duplicates">
          <input value={v.website_domain} onChange={set('website_domain')} style={adminInput} placeholder="example.com.sa" />
        </Field>
        <Field label="Sector">
          <input value={v.sector} onChange={set('sector')} style={adminInput} placeholder="e.g. Real estate development" />
        </Field>
        <Field label="City">
          <input value={v.city} onChange={set('city')} style={adminInput} />
        </Field>
        <Field label="Country">
          <input value={v.country} onChange={set('country')} style={adminInput} />
        </Field>
        <Field label="Known scale (SAR)" hint="Project or deal size if known; blank is unknown">
          <input value={v.scale_sar} onChange={set('scale_sar')} style={adminInput} placeholder="e.g. 450m" />
        </Field>
        <Field label="Likely service">
          <select value={v.likely_service} onChange={set('likely_service')} style={adminInput}>
            <option value="">Not decided</option>
            {GROWTH_SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={v.status} onChange={set('status')} style={adminInput}>
            {COMPANY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select value={v.source} onChange={set('source')} style={adminInput}>
            <option value="">Not recorded</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="LinkedIn page">
          <input value={v.linkedin_url} onChange={set('linkedin_url')} style={adminInput} placeholder="https://" />
        </Field>
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <Field label="Description" style={{ gridColumn: '1 / -1' }}>
          <textarea value={v.description} onChange={set('description')} style={adminTextarea} />
        </Field>
        <Field label="Notes" style={{ gridColumn: '1 / -1' }}>
          <textarea value={v.notes} onChange={set('notes')} style={{ ...adminTextarea, minHeight: 64 }} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <PrimaryButton onClick={save} disabled={busy !== null || !v.name.trim()}>
          {busy ? 'Saving' : id ? 'Save changes' : 'Create company'}
        </PrimaryButton>
        {onDone && <GhostButton onClick={onDone}>Cancel</GhostButton>}
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
