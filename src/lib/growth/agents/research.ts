/**
 * The Research Agent (Unit 2.4, 2026-09-23). Server only.
 *
 * On demand from a company page: searches the web and returns a brief with a
 * summary, projects and scale, recent triggers, decision-makers, the likely
 * service from the site's nine (priority services preferred), a suggested
 * entry offer, and its reasoning. Every fact carries a source; checkBrief
 * drops any fact whose source the search did not return, and removes email
 * addresses. Unknown stays unknown.
 *
 * Every brief is kept as history (growth_research_briefs). Nothing reaches the
 * profile until Ahmad accepts chosen fields. A mock brief is labelled, stored
 * with is_mock, and can never be accepted.
 */

import { logActivity } from '../activity';
import { runAi } from '../ai/run';
import type { WriteResult } from '../api';
import { growthDb, tableExists } from '../db';
import { getGrowthSettings } from '../settings';
import { getApprovedKnowledge, type Actor } from '../kb';
import { GROWTH_SERVICES, TRIGGER_TYPES } from '../model';
import { createContact, getCompany, rescoreCompany, updateCompany, type ResearchBriefRow } from '../prospects';
import { createSignal } from '../signals';
import { isRealEvidenceUrl } from '../signalsModel';
import { extractJsonObject, knowledgeText } from './json';
import { checkBrief, type AcceptableField, type BriefContent } from './researchModel';

export const RESEARCH_AGENT = 'research-agent';
const MAX_SEARCHES = 8;

function systemPrompt(input: { services: string; offers: string; priority: string[]; disallowed: string; targeting: string }): string {
  return [
    'You research companies for PaceMakers Business Consultants, a corporate finance and transaction advisory firm serving KSA, the GCC and worldwide mandates.',
    'Use web search to find current, verifiable facts about the company named by the user.',
    '',
    'Rules you must follow:',
    '- Every fact must list at least one source URL that your web search returned. A fact you cannot source is left out, and named in "unknowns".',
    '- Unknown stays unknown. Never guess, estimate as fact, or fill a gap from general knowledge.',
    '- Never invent people, job titles, email addresses, phone numbers or links. Do not include any email address at all.',
    '- Decision-makers are named people in finance, strategy, investment or executive roles with a public source.',
    '- Sizes are in SAR as plain numbers; convert only when the source states the amount, and say so in the detail.',
    '',
    'Choose the likely service from these site services, by slug, preferring the priority services when the evidence fits equally:',
    GROWTH_SERVICES.map((s) => `- ${s.value}: ${s.label}`).join('\n'),
    `Priority services: ${input.priority.join(', ') || 'none set'}.`,
    '',
    'Approved service knowledge:',
    input.services || '(none approved)',
    '',
    'Suggest an entry offer by its key from these approved offers, or null:',
    input.offers || '(none approved)',
    '',
    input.targeting ? `Targeting rules:\n${input.targeting}\n` : '',
    input.disallowed ? `Never say:\n${input.disallowed}\n` : '',
    'Trigger types: ' + TRIGGER_TYPES.map((t) => t.value).join(', ') + '.',
    '',
    'Answer with one JSON object and nothing else, in this shape:',
    '{"summary":{"value":string|null,"sources":[url]},"sector":{"value":string|null,"sources":[url]},"city":{"value":string|null,"sources":[url]},',
    '"projects":[{"name":string,"detail":string,"scale_sar":number|null,"sources":[url]}],',
    '"recent_triggers":[{"trigger_type":string,"date":"YYYY-MM-DD"|null,"summary":string,"sources":[url]}],',
    '"decision_makers":[{"name":string,"title":string|null,"sources":[url]}],',
    '"likely_service":{"value":slug|null,"reason":string},"entry_offer":{"value":key|null,"reason":string},',
    '"reasoning":string,"unknowns":[string]}',
  ].join('\n');
}

export type ResearchOutcome = WriteResult<{ brief: ResearchBriefRow; mock: boolean }>;

export async function runResearch(companyId: string, actor: Actor, opts: { isTest?: boolean } = {}): Promise<ResearchOutcome> {
  const company = await getCompany(companyId);
  if (!company) return { ok: false, status: 404, error: 'Company not found' };
  if (!(await tableExists('growth_research_briefs'))) return { ok: false, status: 503, error: 'Research briefs need 088_growth_prospecting.sql applied first. No AI call was made.' };

  const isTest = Boolean(opts.isTest || company.is_test);
  const [kb, settings] = await Promise.all([getApprovedKnowledge({ includeTest: isTest }), getGrowthSettings()]);
  const offerKeys = kb.offer.map((o) => o.key).filter((k): k is string => Boolean(k));
  const system = systemPrompt({
    services: knowledgeText(kb.service.map((s) => ({ title: `${s.title} (${s.key})`, content: s.content }))),
    offers: kb.offer.map((o) => `- ${o.key}: ${o.title}. ${String(o.content.scope ?? '')}`).join('\n'),
    priority: settings.settings.priority_services,
    disallowed: kb.disallowed.map((d) => `- ${d.title}: ${String(d.content.detail ?? '')}`).join('\n'),
    targeting: knowledgeText(kb.targeting),
  });
  const known = [company.website_domain && `Website: ${company.website_domain}`, company.city && `City on file: ${company.city}`, company.country && `Country on file: ${company.country}`, company.sector && `Sector on file: ${company.sector}`]
    .filter(Boolean)
    .join('\n');

  const result = await runAi({
    agent: RESEARCH_AGENT,
    purpose: 'prospect_research',
    system,
    messages: [{ role: 'user', content: `Research this company: ${company.name}\n${known}` }],
    webSearch: { maxUses: MAX_SEARCHES },
    maxTokens: 8000,
    requireKnowledgeKinds: ['service', 'offer'],
    related: { companyId },
    isTest,
  });
  if (!result.ok) return { ok: false, status: result.reason === 'provider_error' ? 502 : 409, error: result.message, code: result.reason };

  const brief = checkBrief(extractJsonObject(result.text), { allowedUrls: result.sourceUrls, offerKeys, mock: result.mock });
  if (!brief) return { ok: false, status: 502, error: 'The research answer could not be read as a brief, so nothing was saved. Try again.', code: 'unreadable' };

  const { data, error } = await growthDb()
    .from('growth_research_briefs')
    .insert({ company_id: companyId, is_test: isTest, is_mock: result.mock, model: result.model, usage_id: result.usageId, content: brief, created_by_name: actor.name })
    .select('*')
    .single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'The brief could not be saved' };

  await logActivity({
    actorType: 'ai',
    actorId: RESEARCH_AGENT,
    action: 'research.brief',
    summary: `${result.mock ? 'Mock research brief' : 'Research brief'} for ${company.name}: ${brief.projects.length} projects, ${brief.recent_triggers.length} triggers, ${brief.decision_makers.length} people${brief.dropped.length ? `, ${brief.dropped.length} unsourced facts dropped` : ''}`,
    companyId,
    isTest,
    metadata: { brief_id: (data as ResearchBriefRow).id, mock: result.mock, usage_id: result.usageId, requested_by: actor.name },
  });
  return { ok: true, value: { brief: data as ResearchBriefRow, mock: result.mock } };
}

/**
 * Copies chosen fields from a brief into the profile. Only sourced facts are
 * in a brief, so only sourced facts can be accepted. Contacts are created with
 * name and title only; triggers become signals with their source as evidence.
 */
export async function acceptBrief(briefId: string, fields: AcceptableField[], actor: Actor): Promise<WriteResult<{ applied: string[]; skipped: string[] }>> {
  const { data } = await growthDb().from('growth_research_briefs').select('*').eq('id', briefId).maybeSingle();
  const row = data as ResearchBriefRow | null;
  if (!row) return { ok: false, status: 404, error: 'Brief not found' };
  if (row.is_mock) return { ok: false, status: 409, code: 'mock', error: 'This is a mock brief: sample text, not research. It cannot be accepted into a profile.' };
  const brief = row.content as unknown as BriefContent;
  const applied: string[] = [];
  const skipped: string[] = [];
  const patch: Record<string, unknown> = {};

  const take = (field: AcceptableField, column: string, value: string | null | undefined, label: string) => {
    if (!fields.includes(field)) return;
    if (value) {
      patch[column] = value;
      applied.push(label);
    } else skipped.push(`${label}: unknown`);
  };
  take('description', 'description', brief.summary?.value, 'description');
  take('sector', 'sector', brief.sector?.value, 'sector');
  take('city', 'city', brief.city?.value, 'city');
  take('likely_service', 'likely_service', brief.likely_service.value, 'likely service');
  if (fields.includes('scale_sar')) {
    const sizes = brief.projects.map((p) => p.scale_sar).filter((x): x is number => typeof x === 'number');
    if (sizes.length) {
      patch.scale_sar = Math.max(...sizes);
      applied.push('scale');
    } else skipped.push('scale: unknown');
  }
  if (Object.keys(patch).length) {
    const r = await updateCompany(row.company_id, patch, actor);
    if (!r.ok) return r;
  }
  if (fields.includes('contacts')) {
    for (const p of brief.decision_makers) {
      const r = await createContact(row.company_id, { full_name: p.name, role_title: p.title, notes: `From a research brief. Source: ${p.sources[0]}` }, actor, { isTest: row.is_test });
      if (r.ok) applied.push(`contact ${p.name}`);
      else skipped.push(`contact ${p.name}: ${r.error}`);
    }
  }
  if (fields.includes('signals')) {
    for (const t of brief.recent_triggers) {
      const evidence = t.sources.find(isRealEvidenceUrl);
      if (!evidence || !t.date) {
        skipped.push(`signal "${t.summary.slice(0, 60)}": ${evidence ? 'no date' : 'no usable evidence link'}`);
        continue;
      }
      const r = await createSignal({ trigger_type: t.trigger_type, signal_date: t.date, summary: t.summary, evidence_url: evidence, company_id: row.company_id, source_name: 'Research brief' }, actor, { isTest: row.is_test });
      if (r.ok) applied.push(`signal ${t.date}`);
      else skipped.push(`signal "${t.summary.slice(0, 60)}": ${r.error}`);
    }
  }

  const accepted = [...new Set([...(row.accepted ?? []), ...fields])];
  await growthDb().from('growth_research_briefs').update({ accepted, accepted_at: new Date().toISOString(), accepted_by_name: actor.name }).eq('id', briefId);
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'research.accepted', summary: `Accepted from a research brief: ${applied.join(', ') || 'nothing new'}`, companyId: row.company_id, isTest: row.is_test, metadata: { brief_id: briefId, applied, skipped } });
  await rescoreCompany(row.company_id, { actor });
  return { ok: true, value: { applied, skipped } };
}
