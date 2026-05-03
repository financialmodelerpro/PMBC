import type { Json } from '@/types/database';

import { Hero } from './sections/Hero';
import { Paragraphs } from './sections/Paragraphs';
import { StatsBlock } from './sections/StatsBlock';
import { ServiceCards } from './sections/ServiceCards';
import { SectorGrid } from './sections/SectorGrid';
import { ProcessSteps } from './sections/ProcessSteps';
import { NetworkPartners } from './sections/NetworkPartners';
import { FounderBlock } from './sections/FounderBlock';
import { TextImage } from './sections/TextImage';
import { CtaBlock } from './sections/CtaBlock';
import { Quote } from './sections/Quote';
import { FmpIntro } from './sections/FmpIntro';
import { ServiceDetail } from './sections/ServiceDetail';
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

const REGISTRY: Record<
  string,
  (args: { content: Record<string, unknown> }) => React.ReactElement | null
> = {
  hero: Hero,
  paragraphs: Paragraphs,
  stats_block: StatsBlock,
  service_cards: ServiceCards,
  sector_grid: SectorGrid,
  process_steps: ProcessSteps,
  network_partners: NetworkPartners,
  founder_block: FounderBlock,
  text_image: TextImage,
  cta_block: CtaBlock,
  quote: Quote,
  fmp_intro: FmpIntro,
  service_detail: ServiceDetail,
};

export function SectionRenderer({ section }: { section: SectionRow }) {
  const content = asObject(section.content);
  const Component = REGISTRY[section.section_type];
  if (!Component) {
    return <SectionPlaceholder sectionType={section.section_type} />;
  }
  return <Component content={content} />;
}
