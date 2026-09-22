/**
 * The Knowledge Base model (Unit 1.3, 2026-09-22): the kinds of approved
 * knowledge, their fields, and the rules for saving and approving them.
 *
 * Pure: no database access, so the admin form, the API and the verifier share
 * it. The table is `growth_kb_items` (migration 084); the kinds below are
 * mirrored in its CHECK list, and `npm run verify-growth-kb` fails if they drift.
 *
 * Each item stores its kind's fields in `content` as JSON. A field is a line of
 * text, a paragraph, or a list (one entry per line in the form). Adding a field
 * here needs no migration.
 */

import { z } from 'zod';

import { SERVICES } from '@/config/services';

import { GROWTH_SERVICES } from './model';

export type KbFieldType = 'text' | 'textarea' | 'list';
export type KbField = { key: string; label: string; type: KbFieldType; hint?: string; required?: boolean };

export type KbKindConfig = {
  kind: KbKind;
  label: string;
  singular: string;
  /** What the item's title means for this kind, e.g. the question of an FAQ. */
  titleLabel: string;
  purpose: string;
  fields: KbField[];
  /** Fixed kinds hold only their starter items: no new ones can be added. */
  fixed?: boolean;
  /**
   * site_page: a service, linked to its own site page by its key (no mapping step).
   * related_services: an offer, linked to any of the nine services.
   * case_study: a case study, linked to its existing record.
   */
  link?: 'site_page' | 'related_services' | 'case_study';
};

export const KB_KINDS_LIST = [
  'service',
  'offer',
  'case_study',
  'credential',
  'faq',
  'messaging',
  'disallowed',
  'qualification',
  'escalation',
  'targeting',
] as const;
export type KbKind = (typeof KB_KINDS_LIST)[number];

export const KB_STATUSES = ['draft', 'approved', 'archived'] as const;
export type KbStatus = (typeof KB_STATUSES)[number];

export const KB_KINDS: readonly KbKindConfig[] = [
  {
    kind: 'service',
    label: 'Services',
    singular: 'Service',
    titleLabel: 'Service',
    purpose: "The site's nine services, named as on the site and each linked to its own page.",
    fixed: true,
    link: 'site_page',
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'ideal_client', label: 'Ideal client', type: 'textarea', required: true },
      { key: 'use_cases', label: 'Typical use cases', type: 'list', required: true },
      { key: 'deliverables', label: 'Deliverables', type: 'list', required: true },
      { key: 'sectors', label: 'Sectors', type: 'list', required: true },
    ],
  },
  {
    kind: 'offer',
    label: 'Entry offers',
    singular: 'Entry offer',
    titleLabel: 'Offer',
    purpose: 'The four entry offers, with scope, who each suits, its upsell path and the services it leads to.',
    fixed: true,
    link: 'related_services',
    fields: [
      { key: 'scope', label: 'Scope', type: 'textarea', required: true },
      { key: 'suits', label: 'Who it suits', type: 'textarea', required: true },
      { key: 'upsell_path', label: 'Upsell path', type: 'textarea', required: true },
    ],
  },
  {
    kind: 'case_study',
    label: 'Case studies',
    singular: 'Case study',
    titleLabel: 'Internal name',
    purpose: 'Links to existing case study records, with an internal note on when to use each.',
    link: 'case_study',
    fields: [{ key: 'when_to_use', label: 'When to use it', type: 'textarea', required: true, hint: 'Internal only. Which prospects or situations this case study suits.' }],
  },
  {
    kind: 'credential',
    label: 'Credentials and methodology',
    singular: 'Credential or method',
    titleLabel: 'Topic',
    purpose: 'Team profile, standards, and how an engagement starts and runs.',
    fields: [{ key: 'body', label: 'Text', type: 'textarea', required: true }],
  },
  {
    kind: 'faq',
    label: 'FAQs',
    singular: 'FAQ',
    titleLabel: 'Question',
    purpose: 'Questions prospects ask, with the approved answer.',
    fields: [{ key: 'answer', label: 'Answer', type: 'textarea', required: true }],
  },
  {
    kind: 'messaging',
    label: 'Messaging',
    singular: 'Messaging guide',
    titleLabel: 'Name',
    purpose: 'Tone guidance, phrases to use and phrases to avoid.',
    fields: [
      { key: 'tone', label: 'Tone guidance', type: 'textarea', required: true },
      { key: 'use_phrases', label: 'Phrases to use', type: 'list' },
      { key: 'avoid_phrases', label: 'Phrases to avoid', type: 'list' },
    ],
  },
  {
    kind: 'disallowed',
    label: 'Disallowed content',
    singular: 'Disallowed rule',
    titleLabel: 'Never say',
    purpose: 'Things the AI must never say, such as pricing, guarantees, client names or legal advice.',
    fields: [
      { key: 'detail', label: 'Detail and examples', type: 'textarea', required: true },
      { key: 'instead', label: 'What to do instead', type: 'textarea' },
    ],
  },
  {
    kind: 'qualification',
    label: 'Qualification',
    singular: 'Qualification set',
    titleLabel: 'Name',
    purpose: 'Questions the website agent asks, and when to offer a meeting.',
    fields: [
      { key: 'questions', label: 'Questions to ask', type: 'list', required: true },
      { key: 'offer_meeting_when', label: 'Offer a meeting when', type: 'textarea', required: true },
    ],
  },
  {
    kind: 'escalation',
    label: 'Escalation rules',
    singular: 'Escalation rule',
    titleLabel: 'Topic',
    purpose: 'Topics the AI must hand over to Ahmad.',
    fields: [{ key: 'handover', label: 'How to hand over', type: 'textarea', required: true }],
  },
  {
    kind: 'targeting',
    label: 'Targeting rules',
    singular: 'Targeting rule',
    titleLabel: 'Name',
    purpose: 'Decision-maker job titles and work PMBC will not take on. Read by the scoring agent.',
    fields: [
      { key: 'decision_maker_titles', label: 'Decision-maker job titles', type: 'list' },
      { key: 'excluded_work', label: 'Work PMBC will not take on', type: 'list' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

export function kbKind(kind: KbKind): KbKindConfig {
  const c = KB_KINDS.find((k) => k.kind === kind);
  if (!c) throw new Error(`Unknown Knowledge Base kind: ${kind}`);
  return c;
}

export function isKbKind(value: unknown): value is KbKind {
  return typeof value === 'string' && (KB_KINDS_LIST as readonly string[]).includes(value);
}

/** The four entry offers, created as drafts by migration 084. */
export const KB_OFFER_KEYS = ['model_health_check', 'feasibility_study', 'valuation_report', 'investor_pack'] as const;
/** The nine service keys: the site service slugs (config/services.ts). */
export const KB_SERVICE_KEYS = GROWTH_SERVICES.map((s) => s.value);
/** The site's services, for an offer's related services and for display (config/services.ts). */
export const SITE_SERVICE_OPTIONS = SERVICES.map((s) => ({ slug: s.slug, title: s.title }));

export const KB_LIMITS = { title: 200, text: 300, textarea: 5000, listItem: 300, listItems: 40 } as const;

export type KbContent = Record<string, string | string[]>;
/** The approved copy: the content plus the links, which may be null. */
export type KbSnapshot = Record<string, string | string[] | null>;

/** Clean content to its kind's fields: trims, drops unknown keys and empty list entries. */
export function cleanKbContent(kind: KbKind, raw: unknown): KbContent {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: KbContent = {};
  for (const f of kbKind(kind).fields) {
    const v = input[f.key];
    if (f.type === 'list') {
      const items = (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [])
        .map((x) => (typeof x === 'string' ? x.trim().slice(0, KB_LIMITS.listItem) : ''))
        .filter(Boolean)
        .slice(0, KB_LIMITS.listItems);
      out[f.key] = items;
    } else {
      const s = typeof v === 'string' ? v.trim() : '';
      out[f.key] = s.slice(0, f.type === 'text' ? KB_LIMITS.text : KB_LIMITS.textarea);
    }
  }
  return out;
}

export type KbDraft = { kind: KbKind; title: string; content: KbContent; site_service_slug: string | null; case_study_id: string | null; related_service_slugs?: string[] };

/**
 * Why an item cannot be approved yet, or an empty list when it can. Approval
 * publishes the working copy to every agent, so an incomplete item is refused.
 */
export function approvalProblems(item: KbDraft): string[] {
  const cfg = kbKind(item.kind);
  const problems: string[] = [];
  if (!item.title.trim()) problems.push(`${cfg.titleLabel} is empty`);
  const content = cleanKbContent(item.kind, item.content);
  for (const f of cfg.fields) {
    if (!f.required) continue;
    const v = content[f.key];
    if (Array.isArray(v) ? v.length === 0 : !v) problems.push(`${f.label} is empty`);
  }
  if (item.kind === 'targeting') {
    const t = content as Record<string, string[]>;
    if (!t.decision_maker_titles?.length && !t.excluded_work?.length) problems.push('Add decision-maker titles or excluded work');
  }
  if (cfg.link === 'site_page' && !validSiteServiceSlug(item.site_service_slug)) problems.push('This service is not one of the site services');
  if (cfg.link === 'case_study' && !item.case_study_id) problems.push('Choose the case study record');
  return problems;
}

/** The copy that approval freezes: the content plus the links, so a later edit to a link waits for approval too. */
export function approvedSnapshot(item: KbDraft): KbSnapshot {
  const content = cleanKbContent(item.kind, item.content);
  const cfg = kbKind(item.kind);
  if (cfg.link === 'site_page') return { ...content, site_service_slug: item.site_service_slug };
  if (cfg.link === 'related_services') return { ...content, related_service_slugs: cleanRelatedServices(item.related_service_slugs) };
  if (cfg.link === 'case_study') return { ...content, case_study_id: item.case_study_id };
  return content;
}

/** Request bodies for the admin API. */
export const kbCreateSchema = z.object({
  kind: z.enum(KB_KINDS_LIST),
  title: z.string().trim().min(1).max(KB_LIMITS.title),
  content: z.record(z.string(), z.unknown()).default({}),
  site_service_slug: z.string().nullable().optional(),
  case_study_id: z.string().uuid().nullable().optional(),
  related_service_slugs: z.array(z.string()).max(SERVICES.length).optional(),
});

export const kbEditSchema = z.object({
  title: z.string().trim().min(1).max(KB_LIMITS.title),
  content: z.record(z.string(), z.unknown()),
  site_service_slug: z.string().nullable().optional(),
  case_study_id: z.string().uuid().nullable().optional(),
  related_service_slugs: z.array(z.string()).max(SERVICES.length).optional(),
});

export const kbActionSchema = z.object({ action: z.enum(['approve', 'archive', 'restore']) });

export function validSiteServiceSlug(slug: string | null | undefined): slug is string {
  return Boolean(slug) && SITE_SERVICE_OPTIONS.some((s) => s.slug === slug);
}

/** An offer's related services: known site services only, each once, in site order. */
export function cleanRelatedServices(slugs: readonly string[] | null | undefined): string[] {
  const wanted = new Set(slugs ?? []);
  return SITE_SERVICE_OPTIONS.map((s) => s.slug).filter((slug) => wanted.has(slug));
}
