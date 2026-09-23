/**
 * The Research Agent's brief (Unit 2.4, 2026-09-23). Pure: parsing and the
 * source check, shared by the agent and the verifier.
 *
 * Rules the check enforces, whatever the model wrote:
 *   - every fact needs at least one source, and a source only counts when it
 *     is a real link the web search actually returned (or, in mock mode, a
 *     link in the sample); facts without one are dropped and listed;
 *   - unknown stays unknown: a missing or empty value is null, never guessed;
 *   - no email addresses anywhere (they are removed);
 *   - the likely service must be one of the nine site services, and the
 *     entry offer one of the approved offers, or it is null.
 */

import { z } from 'zod';

import { isGrowthService, TRIGGER_TYPES, type TriggerType } from '../model';
import { isRealEvidenceUrl } from '../signalsModel';
import { stripEmails } from './json';

export type Sourced = { value: string; sources: string[] } | null;
export type BriefProject = { name: string; detail: string; scale_sar: number | null; sources: string[] };
export type BriefTrigger = { trigger_type: TriggerType; date: string | null; summary: string; sources: string[] };
export type BriefPerson = { name: string; title: string | null; sources: string[] };

export type BriefContent = {
  summary: Sourced;
  sector: Sourced;
  city: Sourced;
  projects: BriefProject[];
  recent_triggers: BriefTrigger[];
  decision_makers: BriefPerson[];
  likely_service: { value: string | null; reason: string };
  entry_offer: { value: string | null; reason: string };
  reasoning: string;
  unknowns: string[];
  /** Facts removed because no source the search returned supports them. */
  dropped: string[];
};

const sources = z.array(z.string()).max(12).default([]);
const sourced = z.object({ value: z.string().nullable().optional(), sources }).nullable().optional();

export const rawBriefSchema = z.object({
  summary: sourced,
  sector: sourced,
  city: sourced,
  projects: z.array(z.object({ name: z.string(), detail: z.string().optional().default(''), scale_sar: z.number().nullable().optional(), sources })).max(20).default([]),
  recent_triggers: z.array(z.object({ trigger_type: z.string(), date: z.string().nullable().optional(), summary: z.string(), sources })).max(20).default([]),
  decision_makers: z.array(z.object({ name: z.string(), title: z.string().nullable().optional(), sources })).max(20).default([]),
  likely_service: z.object({ value: z.string().nullable().optional(), reason: z.string().optional().default('') }).nullable().optional(),
  entry_offer: z.object({ value: z.string().nullable().optional(), reason: z.string().optional().default('') }).nullable().optional(),
  reasoning: z.string().optional().default(''),
  unknowns: z.array(z.string()).max(30).default([]),
});

/**
 * Validates a raw brief against the sources the search returned. `allowedUrls`
 * is the provider's list; `mock` accepts the sample's example.invalid links,
 * which can never pass as real evidence anywhere else.
 */
export function checkBrief(raw: unknown, opts: { allowedUrls: string[]; offerKeys: string[]; mock: boolean }): BriefContent | null {
  const parsed = rawBriefSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const allowed = new Set(opts.allowedUrls.map((u) => u.trim()));
  const dropped: string[] = [];
  const good = (urls: string[]) => urls.map((u) => u.trim()).filter((u) => allowed.has(u) && (opts.mock || isRealEvidenceUrl(u)));
  const clean = (s: string, max: number) => stripEmails(s.trim()).slice(0, max);

  const fact = (label: string, f: z.infer<typeof sourced>, max = 1500): Sourced => {
    const value = f?.value?.trim();
    if (!value) return null;
    const src = good(f?.sources ?? []);
    if (!src.length) {
      dropped.push(`${label}: "${clean(value, 120)}" (no source the search returned)`);
      return null;
    }
    return { value: clean(value, max), sources: src };
  };

  const triggerValues = TRIGGER_TYPES.map((t) => t.value) as string[];
  const out: BriefContent = {
    summary: fact('Summary', r.summary, 3000),
    sector: fact('Sector', r.sector, 120),
    city: fact('City', r.city, 120),
    projects: [],
    recent_triggers: [],
    decision_makers: [],
    likely_service: { value: null, reason: '' },
    entry_offer: { value: null, reason: '' },
    reasoning: clean(r.reasoning, 3000),
    unknowns: r.unknowns.map((u) => clean(u, 300)).filter(Boolean),
    dropped,
  };
  for (const p of r.projects) {
    const src = good(p.sources);
    if (!src.length) dropped.push(`Project: "${clean(p.name, 120)}"`);
    else out.projects.push({ name: clean(p.name, 200), detail: clean(p.detail, 1000), scale_sar: typeof p.scale_sar === 'number' && p.scale_sar > 0 ? p.scale_sar : null, sources: src });
  }
  for (const t of r.recent_triggers) {
    const src = good(t.sources);
    if (!src.length) dropped.push(`Trigger: "${clean(t.summary, 120)}"`);
    else
      out.recent_triggers.push({
        trigger_type: (triggerValues.includes(t.trigger_type) ? t.trigger_type : 'other') as TriggerType,
        date: t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null,
        summary: clean(t.summary, 1000),
        sources: src,
      });
  }
  for (const p of r.decision_makers) {
    const src = good(p.sources);
    if (!src.length) dropped.push(`Person: "${clean(p.name, 120)}"`);
    else out.decision_makers.push({ name: clean(p.name, 200), title: p.title ? clean(p.title, 200) : null, sources: src });
  }
  const svc = r.likely_service?.value ?? null;
  out.likely_service = { value: svc && isGrowthService(svc) ? svc : null, reason: clean(r.likely_service?.reason ?? '', 1000) };
  const offer = r.entry_offer?.value ?? null;
  out.entry_offer = { value: offer && opts.offerKeys.includes(offer) ? offer : null, reason: clean(r.entry_offer?.reason ?? '', 1000) };
  return out;
}

/** What Ahmad can accept from a brief into the profile. */
export const ACCEPTABLE_FIELDS = [
  { key: 'description', label: 'Summary as the description' },
  { key: 'sector', label: 'Sector' },
  { key: 'city', label: 'City' },
  { key: 'likely_service', label: 'Likely service' },
  { key: 'scale_sar', label: 'Largest project size as the known scale' },
  { key: 'contacts', label: 'Decision-makers as contacts (names and titles only)' },
  { key: 'signals', label: 'Recent triggers as signals' },
] as const;
export type AcceptableField = (typeof ACCEPTABLE_FIELDS)[number]['key'];

export const acceptSchema = z.object({ fields: z.array(z.enum(ACCEPTABLE_FIELDS.map((f) => f.key) as [AcceptableField, ...AcceptableField[]])).min(1, 'Choose at least one field') });

export function emptyBrief(): BriefContent {
  return { summary: null, sector: null, city: null, projects: [], recent_triggers: [], decision_makers: [], likely_service: { value: null, reason: '' }, entry_offer: { value: null, reason: '' }, reasoning: '', unknowns: [], dropped: [] };
}
