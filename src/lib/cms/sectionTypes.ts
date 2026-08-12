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
  | 'founder_hero'
  | 'founder_credentials'
  | 'text_image'
  | 'cta_block'
  | 'quote'
  | 'fmp_intro'
  | 'service_detail'
  | 'media'
  | 'prose_checklist'
  | 'feature_cards'
  | 'audience_carousel';

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
      // Short capability labels under the subtitle. Empty by default, so every
      // hero authored before this field existed renders exactly as it did.
      tags: [],
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
    description: 'Rich-text body content, with an optional heading and alignment.',
    implemented: true,
    // `align` defaults to 'left', matching how every section authored before
    // the field existed already renders.
    defaultContent: { heading: '', html: '<p></p>', align: 'left' },
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
    type: 'founder_hero',
    label: 'Founder hero',
    description:
      'Page-leading founder identity: portrait, name, two-line title, credentials, CTAs.',
    implemented: true,
    defaultContent: {
      eyebrow: 'Founder',
      name: '',
      title_primary: '',
      title_accent: '',
      credentials_line: '',
      intro: '',
      photo_url: '',
      cta_primary_label: '',
      cta_primary_href: '',
      cta_secondary_label: '',
      cta_secondary_href: '',
    },
  },
  {
    type: 'founder_credentials',
    label: 'Credential list',
    description:
      'Heading plus a list of short strings, shown as a numbered list, pills, or cards.',
    implemented: true,
    defaultContent: {
      heading: '',
      intro: '',
      display: 'numbered',
      items: [],
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
    type: 'prose_checklist',
    label: 'Prose + checklist',
    description: 'Long-form prose beside a gold-ticked checklist, two columns on desktop.',
    implemented: true,
    defaultContent: { eyebrow: '', heading: '', html: '<p></p>', list_heading: '', items: [] },
  },
  {
    type: 'feature_cards',
    label: 'Feature cards',
    description: 'Large cards with metadata chips, a bullet list and a call to action.',
    implemented: true,
    defaultContent: { eyebrow: '', heading: '', intro: '', cards: [] },
  },
  {
    type: 'audience_carousel',
    label: 'Audience carousel',
    description:
      'One wide card at a time, each with an image, advancing automatically with arrows.',
    implemented: true,
    defaultContent: {
      eyebrow: '',
      headline: '',
      intro: '',
      autoplay_seconds: 6,
      items: [],
    },
  },
  {
    type: 'media',
    label: 'Media',
    description:
      'One image, GIF or video standing on its own in the page order, with an optional heading.',
    implemented: true,
    // No `media_position`: this section has no text to sit beside, so the key
    // the shared panel writes would mean nothing here. `width` takes its place.
    defaultContent: {
      media_url: '',
      media_caption: '',
      eyebrow: '',
      heading: '',
      width: 'full',
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
