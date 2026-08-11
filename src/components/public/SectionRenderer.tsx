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
import { SectionPlaceholder } from './sections/Placeholder';

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

/**
 * Sequence-aware variant for the home/page rendering pipeline. We compute a
 * per-section variant and, if the previous section's resolved variant is the
 * same as this one's default, we nudge to the alternate so the page always
 * shows visible rhythm even if the author hasn't set explicit variants.
 */
function resolveVariantSequence(
  sections: SectionRow[],
): Map<string, PmbcVariant> {
  const out = new Map<string, PmbcVariant>();
  let prev: PmbcVariant | null = null;
  for (const s of sections) {
    const styles = asObject(s.styles);
    const explicit = styles.background_variant;
    const isExplicit =
      explicit === 'navy_deep' || explicit === 'cream' || explicit === 'white';
    const def = DEFAULT_VARIANT[s.section_type] ?? 'white';
    let resolved = readVariant(styles, def);
    // If author didn't set an explicit variant and the resolved one matches
    // the previous section, nudge to a contrasting variant so we always have
    // visible rhythm. Hero stays navy_deep regardless.
    if (!isExplicit && prev === resolved && s.section_type !== 'hero') {
      if (prev === 'navy_deep') resolved = 'white';
      else if (prev === 'white') resolved = 'cream';
      else if (prev === 'cream') resolved = 'white';
    }
    out.set(s.id, resolved);
    prev = resolved;
  }
  return out;
}

export function SectionRenderer({
  section,
  variant,
}: {
  section: SectionRow;
  variant?: PmbcVariant;
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
    <Component content={content} styles={styles} variant={resolved} media={media} />
  );
}

/**
 * Render a list of sections with sequence-aware variant resolution. Use this
 * for home/firm pages where rhythm matters.
 */
export function SectionList({ sections }: { sections: SectionRow[] }) {
  const variants = resolveVariantSequence(sections);
  return (
    <>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} variant={variants.get(s.id)} />
      ))}
    </>
  );
}
