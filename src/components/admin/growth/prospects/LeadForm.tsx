'use client';

import { useState } from 'react';

import { adminInput, adminTextarea } from '@/lib/admin/styles';
import { GROWTH_SERVICES, LEAD_SOURCES, PIPELINE_STAGES } from '@/lib/growth/model';

import { parseAmount, sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

export type LeadValues = {
  title: string;
  contact_id: string;
  stage: string;
  recommended_service: string;
  requirement: string;
  deal_size_sar: string;
  timeline: string;
  source: string;
  next_action: string;
  next_action_due: string;
  lost_reason: string;
};
export const emptyLead: LeadValues = { title: '', contact_id: '', stage: 'prospect', recommended_service: '', requirement: '', deal_size_sar: '', timeline: '', source: 'outbound', next_action: '', next_action_due: '', lost_reason: '' };

/** Opens a lead for a company, or edits one. A stage change is dated and logged by the server. */
export function LeadForm({ companyId, leadId, initial, contacts, onDone }: { companyId: string; leadId?: string; initial: LeadValues; contacts: { id: string; full_name: string }[]; onDone?: () => void }) {
  const [v, setV] = useState(initial);
  const { busy, notice, run } = useAction();
  const set = (k: keyof LeadValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = () =>
    run('save', async () => {
      const size = parseAmount(v.deal_size_sar);
      if (Number.isNaN(size)) throw new Error('Deal size: use a number such as 120000000, 120m or 1.2bn');
      const body = { ...v, deal_size_sar: size, contact_id: v.contact_id || null, recommended_service: v.recommended_service || null, next_action_due: v.next_action_due || null };
      if (leadId) await sendJson('PATCH', `/api/admin/growth/leads/${leadId}`, body);
      else await sendJson('POST', `/api/admin/growth/companies/${companyId}/leads`, body);
      if (!leadId) setV(emptyLead);
      onDone?.();
      return leadId ? 'Lead saved.' : 'Lead opened.';
    });

  return (
    <div>
      <div style={grid}>
        <Field label="Title">
          <input value={v.title} onChange={set('title')} style={adminInput} />
        </Field>
        <Field label="Contact">
          <select value={v.contact_id} onChange={set('contact_id')} style={adminInput}>
            <option value="">None yet</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select value={v.stage} onChange={set('stage')} style={adminInput}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select value={v.recommended_service} onChange={set('recommended_service')} style={adminInput}>
            <option value="">Not decided</option>
            {GROWTH_SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal size (SAR)" hint="Blank when unknown">
          <input value={v.deal_size_sar} onChange={set('deal_size_sar')} style={adminInput} placeholder="e.g. 120m" />
        </Field>
        <Field label="Timeline">
          <input value={v.timeline} onChange={set('timeline')} style={adminInput} placeholder="e.g. decision within 3 months" />
        </Field>
        <Field label="Source">
          <select value={v.source} onChange={set('source')} style={adminInput}>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next action">
          <input value={v.next_action} onChange={set('next_action')} style={adminInput} />
        </Field>
        <Field label="Due">
          <input type="date" value={v.next_action_due} onChange={set('next_action_due')} style={adminInput} />
        </Field>
        {v.stage === 'lost' && (
          <Field label="Lost reason">
            <input value={v.lost_reason} onChange={set('lost_reason')} style={adminInput} />
          </Field>
        )}
      </div>
      <Field label="Requirement" style={{ marginTop: 12 }}>
        <textarea value={v.requirement} onChange={set('requirement')} style={{ ...adminTextarea, minHeight: 64 }} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <PrimaryButton onClick={save} disabled={busy !== null || !v.title.trim()}>
          {busy ? 'Saving' : leadId ? 'Save lead' : 'Open lead'}
        </PrimaryButton>
        {onDone && <GhostButton onClick={onDone}>Cancel</GhostButton>}
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}
