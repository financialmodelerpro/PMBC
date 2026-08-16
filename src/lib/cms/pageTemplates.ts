/**
 * Starter templates for the New Page flow (parity Phase 4, FMP
 * CMS_REFERENCE.md section 2.2, which seeds a section list per template).
 *
 * A template is just an ordered list of section types. Content comes from
 * `defaultContentFor`, the same source the "Add section" picker already uses, so
 * a section created by a template and one added by hand start identical. Where a
 * template wants something more specific than the generic default (a contact
 * page's heading, say), it supplies a shallow override merged over that default.
 *
 * display_order is assigned in increments of 10 by the API, matching the rest of
 * the builder, so a section can later be dropped between two others without a
 * full renumber.
 */
import type { Json } from '@/types/database';
import { defaultContentFor, type SectionType } from '@/lib/cms/sectionTypes';

export type TemplateId = 'blank' | 'landing' | 'about' | 'services' | 'contact';

type TemplateSection = {
  type: SectionType;
  /** Shallow-merged over defaultContentFor(type). */
  overrides?: Record<string, unknown>;
};

export type PageTemplate = {
  id: TemplateId;
  label: string;
  description: string;
  sections: TemplateSection[];
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'No sections. Start from an empty page and add your own.',
    sections: [],
  },
  {
    id: 'landing',
    label: 'Landing',
    description: 'Hero, credibility numbers, service cards, closing call to action.',
    sections: [
      { type: 'hero' },
      { type: 'stats_block' },
      { type: 'service_cards' },
      { type: 'cta_block' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    description: 'Hero, founder block, text and image, pull quote, call to action.',
    sections: [
      { type: 'hero' },
      { type: 'founder_block' },
      { type: 'text_image' },
      { type: 'quote' },
      { type: 'cta_block' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Hero, service card grid, closing call to action.',
    sections: [
      { type: 'hero' },
      { type: 'service_cards' },
      { type: 'cta_block' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Hero, contact detail block, call to action.',
    sections: [
      { type: 'hero' },
      {
        type: 'text_image',
        // The generic text_image default is a marketing row. A contact page
        // wants the block to read as contact details from the first render,
        // so the admin edits copy rather than working out what it is for.
        overrides: {
          eyebrow: 'Contact',
          heading: 'Speak to us directly',
          body_html:
            '<p>Add your address, email, and phone number here. Replace this paragraph with the detail you want a prospective client to see.</p>',
        },
      },
      { type: 'cta_block' },
    ],
  },
];

const BY_ID = new Map(PAGE_TEMPLATES.map((t) => [t.id, t] as const));

export function isTemplateId(value: string): value is TemplateId {
  return BY_ID.has(value as TemplateId);
}

/**
 * Expand a template into rows ready for insert into `page_sections`.
 * Returns an empty array for `blank`, which is a valid outcome, not a failure.
 */
export function buildTemplateSections(
  id: TemplateId,
  pageSlug: string,
): Array<{
  page_slug: string;
  section_type: string;
  content: Json;
  styles: Json;
  display_order: number;
  visible: boolean;
}> {
  const template = BY_ID.get(id);
  if (!template) return [];

  return template.sections.map((s, index) => {
    const base = defaultContentFor(s.type);
    const content = s.overrides
      ? ({ ...(base as Record<string, unknown>), ...s.overrides } as Json)
      : base;
    return {
      page_slug: pageSlug,
      section_type: s.type,
      content,
      styles: {} as Json,
      display_order: (index + 1) * 10,
      visible: true,
    };
  });
}

/** Slug rule, shared by the client form and the API so they cannot disagree. */
export const SLUG_RX = /^[a-z0-9-]+$/;

/** Title to slug, matching what the New Page form shows while you type. */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
