import type { Json } from '@/types/database';
import type { FmpSection } from './types';
import { cmsVisible, stripHidden, visibleFirst, visibleItems, visibleString } from './visibility';

/**
 * Translates FMP's section vocabulary into PMBC's, so imported pages render
 * through PMBC's own renderers and inherit PMBC's visual system.
 *
 * FMP has 21 section types and PMBC has 16, and they overlap only partly. Ten
 * FMP types appear on the three imported pages today; the rest are mapped where
 * there is an honest equivalent and skipped otherwise. Skipping is deliberate:
 * a placeholder telling a visitor that a section could not be rendered is worse
 * than the section not being there, and PMBC's own `Placeholder` component
 * exists for the page builder, not for the public site.
 *
 * TWO CORRECTIONS APPLIED TO EVERY SECTION
 *
 * 1. Relative URLs are absolutised onto FMP's origin. FMP stores its links as
 *    site-relative paths (`/register`, `/signin`, `/pricing`). Rendered on
 *    pacemakersglobal.com those would point at PMBC pages that do not exist, so
 *    every CTA on all three imported pages would 404. This is not something the
 *    feed does for us and it is not optional.
 *
 * 2. Hidden fields and hidden nested items are removed, per ./visibility.
 */

const FMP_ORIGIN = 'https://app.financialmodelerpro.com';

/** Site-relative FMP links become absolute; anything already absolute is left alone. */
export function absoluteFmpUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (/^(mailto:|tel:|#)/i.test(url)) return url;
  return `${FMP_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** A PMBC section row, in the shape SectionRenderer and SectionList expect. */
export type MappedSection = {
  id: string;
  section_type: string;
  content: Json;
  styles: Json | null;
};

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** True when the section is one of FMP's server-populated placeholders. */
function isDynamic(content: Record<string, unknown>): boolean {
  return typeof content._dynamic === 'string' && content._dynamic.trim() !== '';
}

/**
 * `_dynamic` sections carry a heading and nothing else. FMP fills them at
 * render time from its own database (course lists, upcoming sessions, platform
 * modules, its own testimonials), and the feed cannot include that data. On
 * PMBC they would render as a heading over empty space, promising content that
 * never arrives, so they are dropped whole.
 */
function skipReasonFor(section: FmpSection): string | null {
  if (isDynamic(section.content)) {
    return `dynamic:${String(section.content._dynamic)}`;
  }
  return null;
}

type Mapper = (c: Record<string, unknown>, s: FmpSection) => { type: string; content: Record<string, unknown> } | null;

const MAPPERS: Record<string, Mapper> = {
  hero: (c) => {
    // FMP's HeroSection reads cta1Text/cta1Url and gates them on `cta1`, while
    // some rows still carry the older cta_primary_* keys. Both are read, under
    // the flag FMP itself uses, so a CTA the source hides stays hidden.
    const ctaLabel = visibleFirst(c, ['cta1Text', 'cta_primary_text'], 'cta1');
    const ctaHref = visibleFirst(c, ['cta1Url', 'cta_primary_url'], 'cta1');
    const cta2Label = visibleFirst(c, ['cta2Text', 'cta_secondary_text'], 'cta2');
    const cta2Href = visibleFirst(c, ['cta2Url', 'cta_secondary_url'], 'cta2');
    return {
      type: 'hero',
      content: {
        badge_text: visibleString(c, 'badge') || visibleString(c, 'status_badge'),
        headline: visibleString(c, 'headline'),
        subtitle: visibleString(c, 'subtitle'),
        cta_label: ctaLabel && ctaHref ? ctaLabel : '',
        cta_href: ctaLabel && ctaHref ? absoluteFmpUrl(ctaHref) : '',
        cta_secondary_label: cta2Label && cta2Href ? cta2Label : '',
        cta_secondary_href: cta2Label && cta2Href ? absoluteFmpUrl(cta2Href) : '',
      },
    };
  },

  stats: (c) => {
    const stats = visibleItems(c.items)
      .map((i) => ({ value: text(i.value), label: text(i.label) }))
      .filter((s) => s.value || s.label);
    if (!stats.length) return null;
    return { type: 'stats_block', content: { intro: visibleString(c, 'heading'), stats } };
  },

  cards: (c) => {
    const items = visibleItems(c.benefits).length ? visibleItems(c.benefits) : visibleItems(c.items);
    const cards = items
      .map((i, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        title: text(i.title),
        description: text(i.desc) || text(i.description),
        link: absoluteFmpUrl(i.url ?? i.href ?? ''),
      }))
      .filter((card) => card.title || card.description);
    if (!cards.length) return null;
    return {
      type: 'service_cards',
      content: {
        eyebrow: visibleString(c, 'badge'),
        headline: visibleString(c, 'heading'),
        intro: visibleString(c, 'description') || visibleString(c, 'subheading'),
        cards,
      },
    };
  },

  list: (c) => {
    const items = visibleItems(c.items);
    const cards = items
      .map((i, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        title: text(i.title),
        description: text(i.description) || text(i.desc),
        link: '',
      }))
      .filter((card) => card.title || card.description);
    if (!cards.length) return null;
    return {
      type: 'service_cards',
      content: {
        eyebrow: visibleString(c, 'badge'),
        headline: visibleString(c, 'heading'),
        intro: visibleString(c, 'description'),
        cards,
      },
    };
  },

  timeline: (c) => {
    const steps = visibleItems(c.steps)
      .map((s, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        title: text(s.label) || text(s.title),
        description: text(s.desc) || text(s.description),
      }))
      .filter((s) => s.title || s.description);
    if (!steps.length) return null;
    return {
      type: 'process_steps',
      content: {
        eyebrow: visibleString(c, 'badge'),
        heading: visibleString(c, 'heading'),
        intro: visibleString(c, 'subheading'),
        steps,
      },
    };
  },

  text_image: (c) => {
    const body = visibleString(c, 'body') || visibleString(c, 'html');
    const image = text(c.imageSrc);
    const heading = visibleString(c, 'heading');
    if (!body && !heading) return null;
    // PMBC's TextImage draws an empty gold-framed box when it has no image, so
    // an imageless FMP text_image becomes `paragraphs` instead. Same lesson as
    // migration 045, which hit this importing /about's introduction.
    if (!image) {
      return {
        type: 'paragraphs',
        content: {
          heading,
          html: body,
          align: text(c.body_align) === 'justify' ? 'justify' : 'left',
        },
      };
    }
    return {
      type: 'text_image',
      content: {
        heading,
        body_html: body,
        image_url: image,
        image_alt: heading || 'Financial Modeler Pro',
        image_position: text(c.imagePosition) === 'left' ? 'left' : 'right',
      },
    };
  },

  cta: (c) => {
    // FMP's CtaSection gates its two buttons on `buttonText` and `button2Text`.
    // The Modeling Hub's second button is hidden and its label still contains
    // an uninterpolated "{trialDays}" placeholder, so honouring the flag is
    // what keeps that string off PMBC.
    const primaryLabel = visibleFirst(c, ['cta_text', 'buttonText'], 'buttonText');
    const primaryHref = visibleFirst(c, ['cta_url', 'buttonUrl'], 'buttonText');
    const secondLabel = visibleFirst(c, ['button2Text', 'buttonText'], 'button2Text');
    const secondHref = visibleFirst(c, ['button2Url', 'buttonUrl'], 'button2Text');
    const loginLabel = visibleString(c, 'login_text');
    const loginHref = visibleString(c, 'login_url');
    const headline = visibleString(c, 'heading');
    const body = visibleString(c, 'description') || visibleString(c, 'subtitle');
    if (!headline && !body) return null;

    // The secondary slot takes whichever of the two survived its flag, so a
    // hidden second button does not leave a gap that a login link fills wrongly.
    const secondary =
      secondLabel && secondHref && secondLabel !== primaryLabel
        ? { label: secondLabel, href: secondHref }
        : loginLabel && loginHref
          ? { label: loginLabel, href: loginHref }
          : null;

    return {
      type: 'cta_block',
      content: {
        headline,
        subhead: body,
        eyebrow: visibleString(c, 'badge'),
        cta_primary_label: primaryLabel && primaryHref ? primaryLabel : '',
        cta_primary_href: primaryLabel && primaryHref ? absoluteFmpUrl(primaryHref) : '',
        cta_secondary_label: secondary?.label ?? '',
        cta_secondary_href: secondary ? absoluteFmpUrl(secondary.href) : '',
      },
    };
  },

  banner: (c) => {
    const headline = visibleString(c, 'heading');
    const body = visibleString(c, 'description');
    if (!headline && !body) return null;
    const label = visibleString(c, 'cta_text');
    const href = visibleString(c, 'cta_url');
    return {
      type: 'cta_block',
      content: {
        eyebrow: visibleString(c, 'badge_text') || visibleString(c, 'badge'),
        headline,
        subhead: body,
        cta_primary_label: label && href ? label : '',
        cta_primary_href: label && href ? absoluteFmpUrl(href) : '',
      },
    };
  },

  // Types not present on the three imported pages today, mapped so a future
  // edit on FMP does not silently drop a section.
  text: (c) => {
    const body = visibleString(c, 'body') || visibleString(c, 'content') || visibleString(c, 'text');
    if (!body) return null;
    return { type: 'paragraphs', content: { heading: visibleString(c, 'heading'), html: body, align: 'left' } };
  },
  rich_text: (c) => MAPPERS.text(c, {} as FmpSection),
  faq: (c) => {
    const items = visibleItems(c.items).length ? visibleItems(c.items) : visibleItems(c.faqs);
    const cards = items
      .map((i, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        title: text(i.question) || text(i.title),
        description: text(i.answer) || text(i.description),
        link: '',
      }))
      .filter((card) => card.title);
    if (!cards.length) return null;
    return {
      type: 'service_cards',
      content: { headline: visibleString(c, 'heading'), eyebrow: visibleString(c, 'badge'), cards },
    };
  },
  columns: (c) => {
    const items = visibleItems(c.columns).length ? visibleItems(c.columns) : visibleItems(c.items);
    const cards = items
      .map((i, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        title: text(i.title) || text(i.heading),
        description: text(i.description) || text(i.body) || text(i.desc),
        link: '',
      }))
      .filter((card) => card.title || card.description);
    if (!cards.length) return null;
    return {
      type: 'service_cards',
      content: { headline: visibleString(c, 'heading'), eyebrow: visibleString(c, 'badge'), cards },
    };
  },
  image: (c) => {
    const src = text(c.src) || text(c.imageSrc) || text(c.url);
    if (!src) return null;
    return {
      type: 'media',
      content: {
        media_url: src,
        media_caption: visibleString(c, 'caption'),
        heading: visibleString(c, 'heading'),
        width: 'wide',
      },
    };
  },
  video: (c) => {
    const src = text(c.src) || text(c.url) || text(c.videoUrl);
    // Only a direct file can render here. An embed URL (YouTube, Vimeo) needs
    // an iframe, which PMBC deliberately does not render from remote content.
    if (!src || !/\.(mp4|webm)(\?|$)/i.test(src)) return null;
    return {
      type: 'media',
      content: {
        media_url: src,
        media_caption: visibleString(c, 'caption'),
        heading: visibleString(c, 'heading'),
        width: 'wide',
      },
    };
  },
};

/**
 * Types with no honest PMBC equivalent. Listed explicitly rather than falling
 * through the default, so the skip is a decision on the record and the
 * verification can assert the list.
 *
 *  embed / testimonials  always `_dynamic` on these pages, no data in the feed
 *  spacer                pure layout, and PMBC owns its own vertical rhythm
 *  logo_grid / team      need assets and shapes PMBC's equivalents do not share
 *  pricing_table         FMP commercial terms, not PMBC's to restate
 *  countdown             time-sensitive and client-driven
 */
export const SKIPPED_TYPES: ReadonlySet<string> = new Set([
  'embed',
  'testimonials',
  'spacer',
  'logo_grid',
  'team',
  'pricing_table',
  'countdown',
]);

export type MapResult = {
  sections: MappedSection[];
  skipped: Array<{ section_type: string; reason: string }>;
};

export function mapFmpSections(sections: FmpSection[], slug: string): MapResult {
  const out: MappedSection[] = [];
  const skipped: Array<{ section_type: string; reason: string }> = [];

  const ordered = [...sections].sort((a, b) => a.display_order - b.display_order);

  for (const section of ordered) {
    const type = section.section_type;
    const content = (section.content ?? {}) as Record<string, unknown>;

    const dynamicReason = skipReasonFor(section);
    if (dynamicReason) {
      skipped.push({ section_type: type, reason: dynamicReason });
      continue;
    }
    if (SKIPPED_TYPES.has(type)) {
      skipped.push({ section_type: type, reason: 'no PMBC equivalent' });
      continue;
    }
    const mapper = MAPPERS[type];
    if (!mapper) {
      skipped.push({ section_type: type, reason: 'unmapped type' });
      continue;
    }
    const mapped = mapper(content, section);
    if (!mapped) {
      skipped.push({ section_type: type, reason: 'no renderable content' });
      continue;
    }

    // Final pass: anything the mapper copied through wholesale still has its
    // hidden fields and hidden nested items removed.
    const cleaned = stripHidden(mapped.content) as Record<string, unknown>;

    out.push({
      id: `fmp-${slug}-${section.display_order}-${type}`,
      section_type: mapped.type,
      content: cleaned as Json,
      // FMP's styles are its own visual system and are deliberately dropped:
      // the point of importing is that the content wears PMBC's styling.
      styles: {} as Json,
    });
  }

  return { sections: out, skipped };
}

/** Exported for the verification script and for tests of the flag semantics. */
export const __internal = { cmsVisible, isDynamic, MAPPERS };
