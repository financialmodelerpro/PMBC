import type { Tables } from '@/types/database';

import { SectionRenderer } from './SectionRenderer';
import { PageHeroFallback } from './PageHeroFallback';

type Section = Tables<'page_sections'>;

/**
 * Common render path for the 5 bespoke firm pages (/about, /sectors,
 * /approach, /network, /financial-modeler-pro).
 *
 * Behaviour:
 *  - If the page's first section is a `hero`, sections render as-is.
 *  - Otherwise, a `PageHeroFallback` is prepended with the page-specific
 *    eyebrow / headline / tagline supplied by the caller.
 *  - The empty-sections state still gets the fallback hero so the page is
 *    never blank-topped, even on a fresh install before any sections exist.
 */
export function FirmPageBody({
  sections,
  fallbackHero,
}: {
  sections: Section[];
  fallbackHero: { eyebrow: string; headline: string; tagline?: string };
}) {
  const firstIsHero = sections[0]?.section_type === 'hero';

  return (
    <>
      {!firstIsHero && <PageHeroFallback {...fallbackHero} />}
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
    </>
  );
}
