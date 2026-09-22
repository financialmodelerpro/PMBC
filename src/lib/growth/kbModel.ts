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
  /** The kind links to a public site service (services) or a case study record. */
  link?: 'site_service' | 'case_study';
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
    purpose: 'The six Growth services, each mapped to its related public site service.',
    fixed: true,
    link: 'site_service',
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
    purpose: 'The four entry offers, with scope, who each suits and its upsell path.',
    fixed: true,
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
/** The six service keys: the Growth service values. */
export const KB_SERVICE_KEYS = GROWTH_SERVICES.map((s) => s.value);
/** Public site services a Growth service can map to (config/services.ts). */
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

export type KbDraft = { kind: KbKind; title: string; content: KbContent; site_service_slug: string | null; case_study_id: string | null };

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
  if (cfg.link === 'site_service' && !item.site_service_slug) problems.push('Choose the related public site service');
  if (cfg.link === 'case_study' && !item.case_study_id) problems.push('Choose the case study record');
  return problems;
}

/** The copy that approval freezes: the content plus the links, so a later edit to a link waits for approval too. */
export function approvedSnapshot(item: KbDraft): KbSnapshot {
  const content = cleanKbContent(item.kind, item.content);
  const cfg = kbKind(item.kind);
  if (cfg.link === 'site_service') return { ...content, site_service_slug: item.site_service_slug };
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
});

export const kbEditSchema = z.object({
  title: z.string().trim().min(1).max(KB_LIMITS.title),
  content: z.record(z.string(), z.unknown()),
  site_service_slug: z.string().nullable().optional(),
  case_study_id: z.string().uuid().nullable().optional(),
});

export const kbActionSchema = z.object({ action: z.enum(['approve', 'archive', 'restore']) });

export function validSiteServiceSlug(slug: string | null | undefined): slug is string {
  return Boolean(slug) && SITE_SERVICE_OPTIONS.some((s) => s.slug === slug);
}
