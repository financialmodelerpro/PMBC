/**
 * Valuation tool leads in the Growth Engine (Unit 4.3, 2026-09-23). Server only.
 *
 * Read-only on the tool: its tables are only ever selected from here, never
 * written. A tool lead can be linked to a Growth lead when consent allows: the
 * person gave follow-up consent in the tool and is not suppressed (which
 * includes having unsubscribed from the tool's reminders). Linking creates or
 * reuses the Growth contact and company and opens one Growth lead with source
 * "tool" and the tool lead's id as its reference; the database allows one
 * Growth lead per tool lead (migration 090).
 */

import { toolsDb } from '@/lib/tools/db';

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb } from './db';
import type { Actor } from './kb';
import { normaliseEmail } from './model';
import { contactByEmail, createCompany, createContact, createLead } from './prospects';
import { companyNameKey } from './signalsModel';
import { checkSuppression } from './suppression';

export type ToolLeadView = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  purpose: string | null;
  deal_size_band: string | null;
  below_minimum: boolean;
  country: string | null;
  industry: string | null;
  follow_up_consent: boolean;
  follow_up_consent_at: string | null;
  linkedLeadId: string | null;
};

const COLS = 'id, created_at, name, email, company, purpose, deal_size_band, below_minimum, country, industry, follow_up_consent, follow_up_consent_at, is_test';

export async function listToolLeads(limit = 200): Promise<{ rows: ToolLeadView[]; error: string | null }> {
  const { data, error } = await toolsDb().from('tool_leads').select(COLS).eq('is_test', false).order('created_at', { ascending: false }).limit(limit);
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []) as (Omit<ToolLeadView, 'linkedLeadId'> & { is_test: boolean })[];
  const ids = rows.map((r) => r.id);
  const linked = new Map<string, string>();
  if (ids.length) {
    const { data: leads } = await growthDb().from('growth_leads').select('id, source_ref').eq('source', 'tool').in('source_ref', ids);
    for (const l of (leads ?? []) as { id: string; source_ref: string }[]) linked.set(l.source_ref, l.id);
  }
  return { rows: rows.map((r) => ({ ...r, linkedLeadId: linked.get(r.id) ?? null })), error: null };
}

export async function linkToolLead(toolLeadId: string, actor: Actor): Promise<WriteResult<{ leadId: string }>> {
  const { data } = await toolsDb().from('tool_leads').select(COLS).eq('id', toolLeadId).maybeSingle();
  const t = data as (ToolLeadView & { is_test: boolean }) | null;
  if (!t || t.is_test) return { ok: false, status: 404, error: 'Valuation lead not found' };
  const { data: existing } = await growthDb().from('growth_leads').select('id').eq('source', 'tool').eq('source_ref', t.id).maybeSingle();
  if (existing) return { ok: true, value: { leadId: (existing as { id: string }).id } };
  if (!t.follow_up_consent) return { ok: false, status: 409, code: 'no_consent', error: 'This person did not give follow-up consent in the tool, so they are not linked.' };
  const email = normaliseEmail(t.email);
  if (!email) return { ok: false, status: 422, error: 'The tool lead has no usable email' };
  const sup = await checkSuppression(email);
  if (sup.suppressed) return { ok: false, status: 409, code: 'suppressed', error: `Not linked: ${sup.reasons.map((r) => r.reason).join('; ')}` };

  let contact = await contactByEmail(email);
  let companyId = contact?.company_id ?? null;
  if (!companyId && t.company?.trim()) {
    const { data: cos } = await growthDb().from('growth_companies').select('id, name').eq('is_test', false).limit(5000);
    const match = ((cos ?? []) as { id: string; name: string }[]).find((c) => companyNameKey(c.name) === companyNameKey(t.company));
    if (match) companyId = match.id;
    else {
      const co = await createCompany({ name: t.company.trim(), source: 'tool', sector: t.industry, country: t.country }, actor);
      if (!co.ok) return co;
      companyId = co.value.id;
    }
  }
  if (!contact) {
    const ct = await createContact(companyId, { full_name: t.name, email, consent_status: 'legitimate_interest', consent_source: `Valuation tool follow-up consent${t.follow_up_consent_at ? ` (${t.follow_up_consent_at.slice(0, 10)})` : ''}` }, actor);
    if (!ct.ok) return ct;
    contact = ct.value;
  }
  const lead = await createLead(
    companyId,
    {
      title: `${t.company?.trim() || t.name}: valuation tool`,
      contact_id: contact.id,
      source: 'tool',
      source_ref: t.id,
      recommended_service: 'business-valuation',
      requirement: [t.purpose ? `Purpose: ${t.purpose}` : '', t.deal_size_band ? `Deal size band in the tool: ${t.deal_size_band}${t.below_minimum ? ' (below the minimum)' : ''}` : ''].filter(Boolean).join('. ') || null,
    },
    actor,
  );
  if (!lead.ok) return lead.status === 500 && /duplicate|unique/i.test(lead.error) ? { ok: false, status: 409, error: 'Already linked' } : lead;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'lead.linked_tool', summary: `Linked from the valuation tool (${t.created_at.slice(0, 10)})`, companyId, contactId: contact.id, leadId: lead.value.id, metadata: { tool_lead_id: t.id } });
  return { ok: true, value: { leadId: lead.value.id } };
}

/** Links every tool lead with consent that is not linked yet. */
export async function linkAllEligible(actor: Actor): Promise<{ linked: number; skipped: number; errors: string[] }> {
  const { rows } = await listToolLeads(500);
  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    if (r.linkedLeadId || !r.follow_up_consent) {
      skipped++;
      continue;
    }
    const res = await linkToolLead(r.id, actor);
    if (res.ok) linked++;
    else {
      skipped++;
      if (res.code !== 'suppressed') errors.push(`${r.email}: ${res.error}`);
    }
  }
  return { linked, skipped, errors };
}
