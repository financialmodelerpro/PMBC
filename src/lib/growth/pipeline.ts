/**
 * The Pipeline (Unit 3.4, 2026-09-23). Server only.
 *
 * Leads by stage (a board and a table), each lead's opportunities (service,
 * value band, expected close, won or lost with a reason) and tasks with due
 * dates, and the lead's full timeline. Every change is logged.
 */

import { z } from 'zod';

import { companyTimeline, logActivity, sortTimeline, type TimelineRow } from './activity';
import type { WriteResult } from './api';
import { growthDb } from './db';
import type { Actor } from './kb';
import { isGrowthService, PIPELINE_STAGES, type GrowthContact, type GrowthLead } from './model';
import { listMessages, type MessageRow } from './outreach';
import { VALUE_BANDS } from './outreachModel';
import { getCompany, getLead, updateLead } from './prospects';
import type { ProspectCompany } from './prospectsModel';

export type Opportunity = { id: string; created_at: string; is_test: boolean; lead_id: string; service: string; value_band: string; expected_close: string | null; status: 'open' | 'won' | 'lost'; lost_reason: string | null; notes: string | null; closed_at: string | null };
export type Task = { id: string; created_at: string; is_test: boolean; lead_id: string | null; company_id: string | null; title: string; notes: string | null; due_date: string | null; done_at: string | null; done_by_name: string | null; created_by_name: string | null };

export type PipelineLead = GrowthLead & { companyName: string | null; contactName: string | null; openValue: string | null; nextTaskDue: string | null; openTasks: number; sequence_status?: string; next_follow_up_at?: string | null; meeting_requested?: boolean };

export type PipelineFilters = { temperature: string; service: string; source: string; q: string; includeTest: boolean; view: 'board' | 'table' };

export function parsePipelineFilters(search: Record<string, string | string[] | undefined>): PipelineFilters {
  const one = (k: string) => (typeof search[k] === 'string' ? (search[k] as string) : '');
  return {
    temperature: ['hot', 'warm', 'cold', 'unscored'].includes(one('temperature')) ? one('temperature') : '',
    service: isGrowthService(one('service')) ? one('service') : '',
    source: one('source').replace(/[^a-z_]/g, '').slice(0, 20),
    q: one('q').trim().slice(0, 100),
    includeTest: one('test') === '1',
    view: one('view') === 'table' ? 'table' : 'board',
  };
}

export async function listPipeline(f: PipelineFilters): Promise<{ leads: PipelineLead[]; error: string | null }> {
  let q = growthDb().from('growth_leads').select('*').order('stage_changed_at', { ascending: false }).limit(1000);
  if (!f.includeTest) q = q.eq('is_test', false);
  if (f.service) q = q.eq('recommended_service', f.service);
  if (f.source) q = q.eq('source', f.source);
  if (f.temperature === 'unscored') q = q.is('lead_temperature', null);
  else if (f.temperature) q = q.eq('lead_temperature', f.temperature);
  if (f.q) q = q.ilike('title', `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await q;
  if (error) return { leads: [], error: error.message };
  const leads = (data ?? []) as GrowthLead[];
  const ids = (k: 'company_id' | 'contact_id') => [...new Set(leads.map((l) => l[k]).filter((x): x is string => Boolean(x)))];
  const leadIds = leads.map((l) => l.id);
  const [cos, cts, opps, tasks] = await Promise.all([
    ids('company_id').length ? growthDb().from('growth_companies').select('id, name').in('id', ids('company_id').slice(0, 1000)) : Promise.resolve({ data: [] }),
    ids('contact_id').length ? growthDb().from('growth_contacts').select('id, full_name').in('id', ids('contact_id').slice(0, 1000)) : Promise.resolve({ data: [] }),
    leadIds.length ? growthDb().from('growth_opportunities').select('lead_id, value_band, status').in('lead_id', leadIds.slice(0, 1000)).eq('status', 'open') : Promise.resolve({ data: [] }),
    leadIds.length ? growthDb().from('growth_tasks').select('lead_id, due_date').in('lead_id', leadIds.slice(0, 1000)).is('done_at', null) : Promise.resolve({ data: [] }),
  ]);
  const C = new Map(((cos.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const P = new Map(((cts.data ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));
  const O = new Map<string, string>();
  for (const o of (opps.data ?? []) as { lead_id: string; value_band: string }[]) if (!O.has(o.lead_id)) O.set(o.lead_id, VALUE_BANDS.find((b) => b.value === o.value_band)?.label ?? o.value_band);
  const T = new Map<string, { count: number; due: string | null }>();
  for (const t of (tasks.data ?? []) as { lead_id: string; due_date: string | null }[]) {
    const e = T.get(t.lead_id) ?? { count: 0, due: null };
    e.count++;
    if (t.due_date && (!e.due || t.due_date < e.due)) e.due = t.due_date;
    T.set(t.lead_id, e);
  }
  return {
    leads: leads.map((l) => ({ ...l, companyName: (l.company_id && C.get(l.company_id)) || null, contactName: (l.contact_id && P.get(l.contact_id)) || null, openValue: O.get(l.id) ?? null, nextTaskDue: T.get(l.id)?.due ?? l.next_action_due ?? null, openTasks: T.get(l.id)?.count ?? 0 })),
    error: null,
  };
}

export type LeadBundle = { lead: PipelineLead; company: ProspectCompany | null; contact: GrowthContact | null; opportunities: Opportunity[]; tasks: Task[]; messages: MessageRow[]; timeline: TimelineRow[]; ready: boolean };

export async function getLeadBundle(id: string): Promise<LeadBundle | null> {
  const lead = await getLead(id);
  if (!lead) return null;
  const [company, contactRow, opps, tasks, messages] = await Promise.all([
    lead.company_id ? getCompany(lead.company_id) : Promise.resolve(null),
    lead.contact_id ? growthDb().from('growth_contacts').select('*').eq('id', lead.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    growthDb().from('growth_opportunities').select('*').eq('lead_id', id).order('created_at'),
    growthDb().from('growth_tasks').select('*').eq('lead_id', id).order('done_at', { nullsFirst: true }).order('due_date'),
    listMessages(['draft', 'approved', 'scheduled', 'sent', 'failed', 'rejected', 'cancelled'], { leadId: id, includeTest: true, limit: 200 }),
  ]);
  const { data: leadActs } = await growthDb().from('growth_activity').select('id, created_at, seq, actor_type, actor_id, action, summary, metadata, company_id, contact_id, lead_id, signal_id, is_test').eq('lead_id', id).limit(500);
  const companyActs = lead.company_id ? await companyTimeline(lead.company_id) : [];
  const merged = new Map<string, TimelineRow>();
  for (const r of [...companyActs, ...((leadActs ?? []) as TimelineRow[])]) merged.set(r.id, r);
  return {
    lead: { ...lead, companyName: company?.name ?? null, contactName: (contactRow.data as GrowthContact | null)?.full_name ?? null, openValue: null, nextTaskDue: null, openTasks: 0 },
    company,
    contact: (contactRow.data as GrowthContact | null) ?? null,
    opportunities: (opps.data ?? []) as Opportunity[],
    tasks: (tasks.data ?? []) as Task[],
    messages,
    timeline: sortTimeline([...merged.values()]),
    ready: !opps.error,
  };
}

const SERVICE = z.string().refine(isGrowthService, 'Not one of the site services');
const BAND = z.enum(VALUE_BANDS.map((b) => b.value) as [string, ...string[]]);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const opportunitySchema = z.object({
  service: SERVICE,
  value_band: BAND.default('unknown'),
  expected_close: DATE.nullable().optional(),
  status: z.enum(['open', 'won', 'lost']).default('open'),
  lost_reason: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});
export const taskSchema = z.object({ title: z.string().trim().min(1).max(300), due_date: DATE.nullable().optional(), notes: z.string().trim().max(2000).nullable().optional() });
export const taskUpdateSchema = z.object({ done: z.boolean().optional(), title: z.string().trim().min(1).max(300).optional(), due_date: DATE.nullable().optional() });
export const stageSchema = z.object({ stage: z.enum(PIPELINE_STAGES.map((s) => s.value) as [string, ...string[]]), lost_reason: z.string().trim().max(500).optional() });

function fail(error: { code?: string; message?: string } | null, what: string): { ok: false; status: number; error: string } {
  if (error?.code === '23514') return { ok: false, status: 422, error: `The database refused the ${what}: a lost ${what} needs a reason` };
  return { ok: false, status: error && /does not exist|schema cache/i.test(error.message ?? '') ? 503 : 500, error: error && /does not exist|schema cache/i.test(error.message ?? '') ? 'Needs 089_growth_outreach.sql applied first' : error?.message ?? 'Save failed' };
}

export async function saveOpportunity(leadId: string, id: string | null, input: z.infer<typeof opportunitySchema>, actor: Actor): Promise<WriteResult<Opportunity>> {
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, status: 404, error: 'Lead not found' };
  if (input.status === 'lost' && !input.lost_reason?.trim()) return { ok: false, status: 422, error: 'Give the reason it was lost' };
  const row = { ...input, lead_id: leadId, is_test: lead.is_test, closed_at: input.status === 'open' ? null : new Date().toISOString(), lost_reason: input.status === 'lost' ? input.lost_reason : null };
  const q = id ? growthDb().from('growth_opportunities').update(row).eq('id', id).eq('lead_id', leadId) : growthDb().from('growth_opportunities').insert(row);
  const { data, error } = await q.select('*').single();
  if (error || !data) return fail(error, 'opportunity');
  const o = data as Opportunity;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: id ? 'pipeline.opportunity_updated' : 'pipeline.opportunity_created', summary: `Opportunity ${o.status === 'open' ? (id ? 'updated' : 'opened') : o.status}: ${o.service}, ${VALUE_BANDS.find((b) => b.value === o.value_band)?.label}${o.lost_reason ? `. Lost because ${o.lost_reason}` : ''}`, companyId: lead.company_id, leadId, isTest: lead.is_test, metadata: { opportunity_id: o.id, status: o.status } });
  if (o.status === 'won' && lead.stage !== 'won') await updateLead(leadId, { stage: 'won' }, actor);
  return { ok: true, value: o };
}

export async function createTask(input: { leadId?: string | null; companyId?: string | null; title: string; due_date?: string | null; notes?: string | null }, actor: Actor | null, opts: { isTest?: boolean } = {}): Promise<WriteResult<Task>> {
  let companyId = input.companyId ?? null;
  let isTest = Boolean(opts.isTest);
  if (input.leadId) {
    const lead = await getLead(input.leadId);
    if (!lead) return { ok: false, status: 404, error: 'Lead not found' };
    companyId = companyId ?? lead.company_id;
    isTest = isTest || lead.is_test;
  }
  const { data, error } = await growthDb().from('growth_tasks').insert({ lead_id: input.leadId ?? null, company_id: companyId, title: input.title, due_date: input.due_date ?? null, notes: input.notes ?? null, created_by_name: actor?.name ?? 'Growth Engine', is_test: isTest }).select('*').single();
  if (error || !data) return fail(error, 'task');
  await logActivity({ actorType: actor ? 'admin' : 'system', actorId: actor?.id ?? 'growth', action: 'pipeline.task_created', summary: `Task: ${input.title}${input.due_date ? `, due ${input.due_date}` : ''}`, companyId, leadId: input.leadId ?? null, isTest });
  return { ok: true, value: data as Task };
}

export async function updateTask(id: string, input: z.infer<typeof taskUpdateSchema>, actor: Actor): Promise<WriteResult<Task>> {
  const { data: before } = await growthDb().from('growth_tasks').select('*').eq('id', id).maybeSingle();
  const t = before as Task | null;
  if (!t) return { ok: false, status: 404, error: 'Task not found' };
  const patch: Record<string, unknown> = {};
  if (input.title) patch.title = input.title;
  if ('due_date' in input) patch.due_date = input.due_date ?? null;
  if (input.done !== undefined) {
    patch.done_at = input.done ? new Date().toISOString() : null;
    patch.done_by_name = input.done ? actor.name : null;
  }
  const { data, error } = await growthDb().from('growth_tasks').update(patch).eq('id', id).select('*').single();
  if (error || !data) return fail(error, 'task');
  if (input.done !== undefined) await logActivity({ actorType: 'admin', actorId: actor.id, action: input.done ? 'pipeline.task_done' : 'pipeline.task_reopened', summary: `Task ${input.done ? 'done' : 'reopened'}: ${t.title}`, companyId: t.company_id, leadId: t.lead_id, isTest: t.is_test });
  return { ok: true, value: data as Task };
}

/** Open tasks across the pipeline, soonest first (Daily Brief, Phase 7). */
export async function openTasks(opts: { includeTest?: boolean; limit?: number } = {}): Promise<Task[]> {
  let q = growthDb().from('growth_tasks').select('*').is('done_at', null).order('due_date', { nullsFirst: false }).limit(opts.limit ?? 100);
  if (!opts.includeTest) q = q.eq('is_test', false);
  const { data } = await q;
  return (data ?? []) as Task[];
}
