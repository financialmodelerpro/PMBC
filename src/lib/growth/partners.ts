/**
 * Partners and referrals (Unit 6.3, 2026-09-23). Server only.
 *
 * Partners and past clients by type, each with a check-in cadence (its own,
 * or the Settings default); logging a check-in sets the next one. The daily
 * run emails Ahmad one reminder listing the check-ins due that day.
 * Introductions record who was introduced, when, which way, and the outcome;
 * an introduction can open a lead whose referral source is the partner, and
 * every lead can carry a referral partner and a referral source.
 */

import { z } from 'zod';

import { SITE_HREF } from '@/lib/brand/letterhead';
import { sendEmail } from '@/lib/email/send';

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings } from './engineSettings';
import { riyadhDate } from './format';
import type { Actor } from './kb';
import { normaliseEmail } from './model';
import { createLead, getLead, updateLead } from './prospects';

export const PARTNER_TYPES = [
  { value: 'referral_partner', label: 'Referral partner' },
  { value: 'past_client', label: 'Past client' },
  { value: 'bank', label: 'Bank or lender' },
  { value: 'law_firm', label: 'Law firm' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'developer', label: 'Developer' },
  { value: 'other', label: 'Other' },
] as const;

export const INTRO_OUTCOMES = [
  { value: 'pending', label: 'Pending' },
  { value: 'meeting', label: 'Meeting held' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'no_response', label: 'No response' },
] as const;

export type Partner = { id: string; created_at: string; is_test: boolean; name: string; type: string; company_id: string | null; organisation: string | null; email: string | null; phone: string | null; linkedin_url: string | null; notes: string | null; status: 'active' | 'paused' | 'inactive'; checkin_every_days: number | null; last_checkin_at: string | null; next_checkin_due: string | null; last_reminded_on: string | null };
export type Introduction = { id: string; created_at: string; is_test: boolean; partner_id: string; lead_id: string | null; company_name: string; introduced_on: string; direction: 'to_us' | 'from_us'; outcome: string; notes: string | null };
export type Checkin = { id: string; created_at: string; partner_id: string; note: string | null; by_name: string | null };

const NOT_READY = 'Partners need 092_growth_nurture_partners.sql applied first.';
const enumOf = <T extends readonly { value: string }[]>(l: T) => z.enum(l.map((x) => x.value) as [string, ...string[]]);

export const partnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: enumOf(PARTNER_TYPES),
  organisation: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(40).nullable().optional(),
  linkedin_url: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
  checkin_every_days: z.number().int().min(7).max(730).nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
});

export const introSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  introduced_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(['to_us', 'from_us']).default('to_us'),
  outcome: enumOf(INTRO_OUTCOMES).default('pending'),
  notes: z.string().trim().max(4000).nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  open_lead: z.boolean().optional(),
});

export async function partnersReady(): Promise<boolean> {
  return tableExists('growth_partners');
}

async function defaultCadence(): Promise<number> {
  const e = await getEngineSettings();
  return e.values.partner_checkin_days;
}

const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000 + 3 * 3_600_000).toISOString().slice(0, 10);

export async function listPartners(opts: { includeTest?: boolean; type?: string } = {}): Promise<Partner[]> {
  let q = growthDb().from('growth_partners').select('*').order('next_checkin_due', { nullsFirst: false }).order('name').limit(1000);
  if (!opts.includeTest) q = q.eq('is_test', false);
  if (opts.type) q = q.eq('type', opts.type);
  const { data } = await q;
  return (data ?? []) as Partner[];
}

export async function getPartnerBundle(id: string): Promise<{ partner: Partner; checkins: Checkin[]; intros: Introduction[]; leads: { id: string; title: string; stage: string }[] } | null> {
  const { data } = await growthDb().from('growth_partners').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [c, i, l] = await Promise.all([
    growthDb().from('growth_partner_checkins').select('*').eq('partner_id', id).order('created_at', { ascending: false }).limit(100),
    growthDb().from('growth_introductions').select('*').eq('partner_id', id).order('introduced_on', { ascending: false }).limit(200),
    growthDb().from('growth_leads').select('id, title, stage').eq('referral_partner_id', id).order('created_at', { ascending: false }).limit(200),
  ]);
  return { partner: data as Partner, checkins: (c.data ?? []) as Checkin[], intros: (i.data ?? []) as Introduction[], leads: (l.data ?? []) as { id: string; title: string; stage: string }[] };
}

export async function savePartner(id: string | null, input: z.infer<typeof partnerSchema>, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<Partner>> {
  if (!(await partnersReady())) return { ok: false, status: 503, error: NOT_READY };
  const row: Record<string, unknown> = { ...input, email: normaliseEmail(input.email || null) };
  if (!id) row.next_checkin_due = addDays(new Date(), input.checkin_every_days ?? (await defaultCadence()));
  const q = id ? growthDb().from('growth_partners').update(row).eq('id', id) : growthDb().from('growth_partners').insert({ ...row, is_test: Boolean(opts.isTest) });
  const { data, error } = await q.select('*').single();
  if (error || !data) return { ok: false, status: error?.code === '23514' ? 422 : 500, error: error?.message ?? 'Save failed' };
  const p = data as Partner;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: id ? 'partner.updated' : 'partner.created', summary: `${id ? 'Updated' : 'Added'} ${PARTNER_TYPES.find((t) => t.value === p.type)?.label.toLowerCase()} ${p.name}`, companyId: p.company_id, isTest: p.is_test, metadata: { partner_id: p.id } });
  return { ok: true, value: p };
}

export async function logCheckin(partnerId: string, note: string | null, actor: Actor): Promise<WriteResult<Partner>> {
  const { data } = await growthDb().from('growth_partners').select('*').eq('id', partnerId).maybeSingle();
  const p = data as Partner | null;
  if (!p) return { ok: false, status: 404, error: 'Partner not found' };
  await growthDb().from('growth_partner_checkins').insert({ partner_id: p.id, note, by_name: actor.name, is_test: p.is_test });
  const cadence = p.checkin_every_days ?? (await defaultCadence());
  const now = new Date();
  const { data: after, error } = await growthDb().from('growth_partners').update({ last_checkin_at: now.toISOString(), next_checkin_due: addDays(now, cadence) }).eq('id', p.id).select('*').single();
  if (error || !after) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'partner.checkin', summary: `Checked in with ${p.name}${note ? `: ${note.slice(0, 200)}` : ''}. Next in ${cadence} days.`, companyId: p.company_id, isTest: p.is_test, metadata: { partner_id: p.id } });
  return { ok: true, value: after as Partner };
}

export async function saveIntroduction(partnerId: string, id: string | null, input: z.infer<typeof introSchema>, actor: Actor): Promise<WriteResult<Introduction>> {
  const { data: pRow } = await growthDb().from('growth_partners').select('*').eq('id', partnerId).maybeSingle();
  const p = pRow as Partner | null;
  if (!p) return { ok: false, status: 404, error: 'Partner not found' };
  let leadId = input.lead_id ?? null;
  if (!leadId && input.open_lead && input.direction === 'to_us') {
    const lead = await createLead(null, { title: `${input.company_name}: introduced by ${p.name}`, source: p.type === 'referral_partner' ? 'partner' : 'referral', source_ref: `partner:${p.id}` }, actor, { isTest: p.is_test });
    if (!lead.ok) return lead;
    leadId = lead.value.id;
  }
  if (leadId) {
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, status: 422, error: 'That lead no longer exists' };
    await growthDb().from('growth_leads').update({ referral_partner_id: p.id, referral_source: `${PARTNER_TYPES.find((t) => t.value === p.type)?.label}: ${p.name}` }).eq('id', leadId);
  }
  const row = { partner_id: p.id, lead_id: leadId, company_name: input.company_name, introduced_on: input.introduced_on, direction: input.direction, outcome: input.outcome, notes: input.notes ?? null };
  const q = id ? growthDb().from('growth_introductions').update(row).eq('id', id).eq('partner_id', p.id) : growthDb().from('growth_introductions').insert({ ...row, is_test: p.is_test });
  const { data, error } = await q.select('*').single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  const intro = data as Introduction;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: id ? 'partner.intro_updated' : 'partner.intro', summary: `${input.direction === 'to_us' ? `${p.name} introduced` : `Introduced ${p.name} to`} ${input.company_name}: ${INTRO_OUTCOMES.find((o) => o.value === intro.outcome)?.label}`, leadId, isTest: p.is_test, metadata: { partner_id: p.id, introduction_id: intro.id } });
  if (leadId && ['won', 'lost'].includes(intro.outcome)) {
    const lead = await getLead(leadId);
    if (lead && lead.stage !== intro.outcome) await updateLead(leadId, intro.outcome === 'lost' ? { stage: 'lost', lost_reason: intro.notes ?? 'Lost after the introduction' } : { stage: 'won' }, actor);
  }
  return { ok: true, value: intro };
}

/** Sets the referral partner and source on any lead. */
export async function setReferral(leadId: string, partnerId: string | null, source: string | null, actor: Actor): Promise<WriteResult<{ id: string }>> {
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, status: 404, error: 'Lead not found' };
  const { error } = await growthDb().from('growth_leads').update({ referral_partner_id: partnerId, referral_source: source?.trim() || null }).eq('id', leadId);
  if (error) return { ok: false, status: /referral/.test(error.message ?? '') ? 503 : 500, error: /referral/.test(error.message ?? '') ? NOT_READY : error.message };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'partner.referral_source', summary: `Referral source set: ${source || 'none'}`, leadId, companyId: lead.company_id, isTest: lead.is_test, metadata: { partner_id: partnerId } });
  return { ok: true, value: { id: leadId } };
}

/** The daily reminder: one email listing every check-in due today or overdue, once a day. */
export async function remindCheckins(now: Date = new Date()): Promise<string> {
  if (!(await partnersReady())) return NOT_READY;
  const today = riyadhDate(now);
  const { data } = await growthDb().from('growth_partners').select('*').eq('status', 'active').eq('is_test', false).lte('next_checkin_due', today).limit(200);
  const due = ((data ?? []) as Partner[]).filter((p) => p.last_reminded_on !== today);
  if (!due.length) return 'No partner check-ins due.';
  const engine = await getEngineSettings();
  const items = due.map((p) => `<li>${p.name.replace(/</g, '&lt;')} (${PARTNER_TYPES.find((t) => t.value === p.type)?.label}), due ${p.next_checkin_due}</li>`).join('');
  const res = await sendEmail({ to: engine.values.lead_alert_email, subject: `${due.length} partner check-in${due.length === 1 ? '' : 's'} due`, html: `<p>Due today or overdue:</p><ul>${items}</ul><p><a href="${SITE_HREF}/admin/growth/partners">Open Partners</a></p>` });
  if (res.ok) await growthDb().from('growth_partners').update({ last_reminded_on: today }).in('id', due.map((p) => p.id));
  return `${due.length} check-ins due; reminder ${res.ok ? 'sent' : `not sent (${res.reason})`}.`;
}
