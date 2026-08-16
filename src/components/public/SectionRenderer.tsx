import type { Json } from '@/types/database';
import type { PmbcVariant } from '@/lib/public/tokens';
import {
  readSectionMedia,
  sectionTypeSupportsSharedMedia,
  type SectionMediaValue,
} from '@/lib/cms/sectionMedia';

import { Hero } from './sections/Hero';
import { Paragraphs } from './sections/Paragraphs';
import { StatsBlock } from './sections/StatsBlock';
import { ServiceCards } from './sections/ServiceCards';
import { SectorGrid } from './sections/SectorGrid';
import { ProcessSteps } from './sections/ProcessSteps';
import { NetworkPartners } from './sections/NetworkPartners';
import { FounderBlock } from './sections/FounderBlock';
import { FounderHero } from './sections/FounderHero';
import { FounderCredentials } from './sections/FounderCredentials';
import { TextImage } from './sections/TextImage';
import { CtaBlock } from './sections/CtaBlock';
import { Quote } from './sections/Quote';
import { FmpIntro } from './sections/FmpIntro';
import { ServiceDetail } from './sections/ServiceDetail';
import { MediaSection } from './sections/MediaSection';
import { ProseChecklist } from './sections/ProseChecklist';
import { FeatureCards } from './sections/FeatureCards';
import { AudienceCarousel } from './sections/AudienceCarousel';
import { ContactBody } from './sections/ContactBody';
import { BookingBody } from './sections/BookingBody';
import { ServiceGrid } from './sections/ServiceGrid';
import { Testimonials } from './sections/Testimonials';
import { SectionPlaceholder } from './sections/Placeholder';
import type { SectionContext } from '@/lib/public/sectionContext';
import { fetchApprovedTestimonials } from '@/lib/cms/collections';

type SectionRow = {
  id: string;
  section_type: string;
  content: Json;
  styles: Json | null;
};

function asObject(v: Json | null): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

type RendererProps = {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  /**
   * Shared optional media, resolved here rather than in each renderer so the
   * exclusion rule for types with their own media field lives in one place.
   * Null for every section that has none, and renderers that do not support it
   * simply ignore the prop.
   */
  media?: SectionMediaValue | null;
  /**
   * Per-request data no section row can hold: published contact routes, the
   * booking URL, the founder portrait, the `?service=` pre-fill. Supplied by
   * the route. Renderers that do not need it ignore the prop.
   */
  context?: SectionContext;
};

const REGISTRY: Record<
  string,
  (args: RendererProps) => React.ReactElement | null
> = {
  hero: Hero,
  paragraphs: Paragraphs,
  stats_block: StatsBlock,
  service_cards: ServiceCards,
  sector_grid: SectorGrid,
  process_steps: ProcessSteps,
  network_partners: NetworkPartners,
  founder_block: FounderBlock,
  founder_hero: FounderHero,
  founder_credentials: FounderCredentials,
  text_image: TextImage,
  cta_block: CtaBlock,
  quote: Quote,
  fmp_intro: FmpIntro,
  service_detail: ServiceDetail,
  media: MediaSection,
  prose_checklist: ProseChecklist,
  feature_cards: FeatureCards,
  audience_carousel: AudienceCarousel,
  contact_body: ContactBody,
  booking_body: BookingBody,
  service_grid: ServiceGrid,
  testimonials: Testimonials,
};

/**
 * Default background variant per section type. Authors can override per
 * section by setting `styles.background_variant` to 'navy_deep' | 'cream' |
 * 'white' in the page builder. The home-page rhythm is achieved by either
 * accepting these defaults or alternating explicitly via styles.
 */
const DEFAULT_VARIANT: Record<string, PmbcVariant> = {
  hero: 'navy_deep',
  paragraphs: 'white',
  stats_block: 'white',
  service_cards: 'cream',
  sector_grid: 'white',
  process_steps: 'navy_deep',
  network_partners: 'cream',
  founder_block: 'cream',
  founder_hero: 'navy_deep',
  founder_credentials: 'white',
  text_image: 'cream',
  cta_block: 'navy_deep',
  quote: 'white',
  fmp_intro: 'navy_deep',
  service_detail: 'white',
  // Cream by default: a standalone asset reads as a deliberate pause in the
  // page, and the cream band separates it from the white sections it usually
  // sits between without the weight of a navy one.
  media: 'cream',
  prose_checklist: 'white',
  feature_cards: 'cream',
  audience_carousel: 'cream',
  // Both follow a hero on their own page, so the alternation puts them on cream
  // anyway. Stated here for the case of one rendered outside a sequence, and
  // because cream is the surface the hardcoded markup carried before the move.
  contact_body: 'cream',
  booking_body: 'cream',
  // White is what the hardcoded grid carried, and what the alternation lands on
  // when it follows the video under the /services hero.
  service_grid: 'white',
  // The quote cards are cream, so the band behind them is white by default.
  testimonials: 'white',
};

function readVariant(
  styles: Record<string, unknown>,
  fallback: PmbcVariant,
): PmbcVariant {
  const v = styles.background_variant;
  if (v === 'navy_deep' || v === 'cream' || v === 'white') return v;
  // Legacy: cta_block had `background_style: 'dark' | 'light' | 'accent'`.
  const legacy = styles.background_style;
  if (legacy === 'dark' || legacy === 'accent') return 'navy_deep';
  if (legacy === 'light') return 'white';
  return fallback;
}

/** Section types that open a page and keep the navy treatment. */
const LEADING_DARK_TYPES = new Set(['hero', 'founder_hero']);

/**
 * Sequence-aware variant for the page rendering pipeline.
 *
 * The rhythm is a strict two-tone alternation: navy for the hero, then cream,
 * then white, then cream, and on down the page. It replaces a per-type default
 * plus a nudge rule, which produced a different sequence on every page and let
 * two navy bands land mid-page (home had one at the process steps and another
 * at the closing CTA) purely because of which section types happened to be in
 * the order the operator chose.
 *
 * Navy is now the hero's alone. That is the deliberate consequence of asking
 * for one alternation everywhere: a section type can no longer bring its own
 * background weight to a page, so reordering sections can never change the
 * banding.
 *
 * `DEFAULT_VARIANT` is still the fallback for a section rendered on its own,
 * outside a sequence, where there is no neighbour to alternate against.
 *
 * An explicit `styles.background_variant` set in the page builder still wins,
 * and re-phases the alternation from that point, so an operator who deliberately
 * makes one section cream does not get two cream bands touching underneath it.
 */
function resolveVariantSequence(
  sections: SectionRow[],
): Map<string, PmbcVariant> {
  const out = new Map<string, PmbcVariant>();
  // The first non-hero section after the hero is cream.
  let next: 'cream' | 'white' = 'cream';

  for (const s of sections) {
    const styles = asObject(s.styles);
    const explicit = styles.background_variant;
    const isExplicit =
      explicit === 'navy_deep' || explicit === 'cream' || explicit === 'white';

    if (isExplicit) {
      const chosen = explicit as PmbcVariant;
      out.set(s.id, chosen);
      // A navy override is a break in the two-tone run rather than a step in
      // it, so the alternation resumes where it was rather than flipping.
      if (chosen === 'cream') next = 'white';
      else if (chosen === 'white') next = 'cream';
      continue;
    }

    if (LEADING_DARK_TYPES.has(s.section_type)) {
      out.set(s.id, 'navy_deep');
      next = 'cream';
      continue;
    }

    out.set(s.id, next);
    next = next === 'cream' ? 'white' : 'cream';
  }
  return out;
}

export function SectionRenderer({
  section,
  variant,
  context,
}: {
  section: SectionRow;
  variant?: PmbcVariant;
  context?: SectionContext;
}) {
  const content = asObject(section.content);
  const styles = asObject(section.styles);
  const Component = REGISTRY[section.section_type];
  const resolved =
    variant ?? readVariant(styles, DEFAULT_VARIANT[section.section_type] ?? 'white');
  if (!Component) {
    return <SectionPlaceholder sectionType={section.section_type} />;
  }
  // Types with a dedicated media field are excluded, so a founder card cannot
  // end up with two competing images and no way to tell them apart.
  const media = sectionTypeSupportsSharedMedia(section.section_type)
    ? readSectionMedia(content)
    : null;
  return (
    <Component
      content={content}
      styles={styles}
      variant={resolved}
      media={media}
      context={context}
    />
  );
}

/**
 * Render a list of sections with sequence-aware variant resolution. Use this
 * for home/firm pages where rhythm matters.
 */
export async function SectionList({
  sections,
  context,
}: {
  sections: SectionRow[];
  context?: SectionContext;
}) {
  const variants = resolveVariantSequence(sections);

  // Testimonials are the one thing a section needs that the route cannot
  // sensibly supply, because the block can be added to any page in the builder
  // and a route that forgot to pass them would render it as nothing. Fetched
  // here, and only when the page actually carries one, so every other page pays
  // nothing for it. `fetchApprovedTestimonials` already returns [] rather than
  // throwing when the table is missing.
  const needsTestimonials = sections.some((s) => s.section_type === 'testimonials');
  const resolved: SectionContext | undefined = needsTestimonials
    ? { ...context, testimonials: await fetchApprovedTestimonials() }
    : context;
  return (
    <>
      {sections.map((s) => (
        <SectionRenderer
          key={s.id}
          section={s}
          variant={variants.get(s.id)}
          context={resolved}
        />
      ))}
    </>
  );
}
