import type { Json } from '@/types/database';

export type SectionType =
  | 'hero'
  | 'paragraphs'
  | 'stats_block'
  | 'service_cards'
  | 'sector_grid'
  | 'process_steps'
  | 'network_partners'
  | 'founder_block'
  | 'text_image'
  | 'cta_block'
  | 'quote'
  | 'fmp_intro'
  | 'service_detail';

export type SectionTypeMeta = {
  type: SectionType;
  label: string;
  description: string;
  /** Whether an editor is implemented for this type in the current phase. */
  implemented: boolean;
  /** Default content blob for new sections of this type. */
  defaultContent: Json;
};

export const SECTION_TYPES: SectionTypeMeta[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Page-leading headline, subtitle, and call-to-action.',
    implemented: true,
    defaultContent: {
      badge_text: '',
      headline: 'Headline goes here',
      subtitle: '',
      cta_label: '',
      cta_href: '',
      cta_secondary_label: '',
      cta_secondary_href: '',
      background_style: 'light',
    },
  },
  {
    type: 'paragraphs',
    label: 'Paragraphs',
    description: 'Rich-text body content.',
    implemented: true,
    defaultContent: { html: '<p></p>' },
  },
  {
    type: 'stats_block',
    label: 'Stats',
    description: 'Large number + label callouts.',
    implemented: true,
    defaultContent: {
      intro: '',
      stats: [
        { value: '', label: '' },
        { value: '', label: '' },
      ],
    },
  },
  {
    type: 'service_cards',
    label: 'Service cards',
    description: 'Grid of service cards with number, title, description.',
    implemented: true,
    defaultContent: { intro: '', cards: [] },
  },
  // The remaining types render placeholders in v1; their editors land in Phase 6.
  {
    type: 'sector_grid',
    label: 'Sector grid',
    description: 'Sector coverage grid (Phase 6).',
    implemented: false,
    defaultContent: { items: [] },
  },
  {
    type: 'process_steps',
    label: 'Process steps',
    description: 'Numbered methodology steps (Phase 6).',
    implemented: false,
    defaultContent: { steps: [] },
  },
  {
    type: 'network_partners',
    label: 'Network partners',
    description: 'Sky Gulf, Lynkers, etc. (Phase 6).',
    implemented: false,
    defaultContent: { partners: [] },
  },
  {
    type: 'founder_block',
    label: 'Founder',
    description: 'Founder photo, credentials, bio (Phase 6).',
    implemented: false,
    defaultContent: { name: '', title: '', bio_html: '' },
  },
  {
    type: 'text_image',
    label: 'Text + image',
    description: 'Alternating text-image rows (Phase 6).',
    implemented: false,
    defaultContent: { rows: [] },
  },
  {
    type: 'cta_block',
    label: 'CTA',
    description: 'Single call-to-action panel (Phase 6).',
    implemented: false,
    defaultContent: { headline: '', cta_label: '', cta_href: '' },
  },
  {
    type: 'quote',
    label: 'Quote',
    description: 'Pull quote with attribution (Phase 6).',
    implemented: false,
    defaultContent: { quote: '', attribution: '' },
  },
  {
    type: 'fmp_intro',
    label: 'FMP intro',
    description: 'Financial Modeler Pro introduction block (Phase 6).',
    implemented: false,
    defaultContent: { cta_label: 'Visit Financial Modeler Pro', cta_href: 'https://financialmodelerpro.com' },
  },
  {
    type: 'service_detail',
    label: 'Service detail',
    description: 'Single-service detail block for /services/[slug] (Phase 6).',
    implemented: false,
    defaultContent: {},
  },
];

const META_BY_TYPE = new Map(SECTION_TYPES.map((m) => [m.type, m] as const));

export function getSectionMeta(type: string): SectionTypeMeta | null {
  return META_BY_TYPE.get(type as SectionType) ?? null;
}

export function isSectionType(value: string): value is SectionType {
  return META_BY_TYPE.has(value as SectionType);
}

export function defaultContentFor(type: string): Json {
  return META_BY_TYPE.get(type as SectionType)?.defaultContent ?? {};
}
