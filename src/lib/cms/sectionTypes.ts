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
  {
    type: 'sector_grid',
    label: 'Sector grid',
    description: 'Sector coverage grid with iconed cards.',
    implemented: true,
    defaultContent: {
      heading: '',
      intro: '',
      sectors: [],
    },
  },
  {
    type: 'process_steps',
    label: 'Process steps',
    description: 'Numbered methodology steps (Understand → Analyse → Model → Advise).',
    implemented: true,
    defaultContent: {
      heading: '',
      intro: '',
      steps: [
        { number: '01', title: 'Understand', description: '' },
        { number: '02', title: 'Analyse', description: '' },
        { number: '03', title: 'Model', description: '' },
        { number: '04', title: 'Advise', description: '' },
      ],
    },
  },
  {
    type: 'network_partners',
    label: 'Network partners',
    description: 'Partner organization cards (Sky Gulf, Lynkers, etc.).',
    implemented: true,
    defaultContent: {
      heading: '',
      intro: '',
      partners: [],
    },
  },
  {
    type: 'founder_block',
    label: 'Founder',
    description: 'Founder photo, credentials, bio, optional CTAs.',
    implemented: true,
    defaultContent: {
      photo_url: '',
      name: '',
      credentials_line: '',
      bio_html: '<p></p>',
      cta_primary_label: '',
      cta_primary_href: '',
      cta_secondary_label: '',
      cta_secondary_href: '',
      layout: 'image_left',
    },
  },
  {
    type: 'text_image',
    label: 'Text + image',
    description: 'Two-column text and image row with configurable position.',
    implemented: true,
    defaultContent: {
      heading: '',
      body_html: '<p></p>',
      image_url: '',
      image_alt: '',
      image_caption: '',
      image_position: 'right',
      cta_label: '',
      cta_href: '',
    },
  },
  {
    type: 'cta_block',
    label: 'CTA',
    description: 'Full-width call-to-action panel with light/dark/accent variants.',
    implemented: true,
    defaultContent: {
      headline: '',
      subhead: '',
      cta_primary_label: '',
      cta_primary_href: '',
      cta_secondary_label: '',
      cta_secondary_href: '',
      background_style: 'light',
    },
  },
  {
    type: 'quote',
    label: 'Quote',
    description: 'Pull quote with attribution.',
    implemented: true,
    defaultContent: {
      quote_text: '',
      attribution_name: '',
      attribution_role: '',
      attribution_photo_url: '',
      alignment: 'center',
    },
  },
  {
    type: 'fmp_intro',
    label: 'FMP intro',
    description: 'Financial Modeler Pro introduction block.',
    implemented: true,
    defaultContent: {
      heading: '',
      description_html: '<p></p>',
      feature_points: [],
      cta_label: 'Visit Financial Modeler Pro',
      cta_href: 'https://www.financialmodelerpro.com',
      logo_url: '',
    },
  },
  {
    type: 'service_detail',
    label: 'Service detail',
    description: 'Detail block for a single service (used on /services/[slug]).',
    implemented: true,
    defaultContent: {
      service_slug: '',
      full_description_html: '<p></p>',
      deliverables: [],
      timeline_text: '',
      target_audience_text: '',
    },
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
