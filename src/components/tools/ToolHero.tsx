import { Check } from 'lucide-react';

import { RichText } from '@/components/public/RichText';
import { SectionList } from '@/components/public/SectionRenderer';
import type { PageSection } from '@/lib/cms/pages';
import { PAGE_GUTTER } from '@/lib/public/layout';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * The opening of a tool page: a navy band with the title, a one-line promise
 * and trust chips.
 *
 * Every other page shares the 70vh hero in HERO_FRAME. A tool page is the
 * exception on purpose: the visitor came to use the calculator, so the band is
 * compact and the first step sits above the fold on a laptop. The treatment is
 * otherwise the site's: navy radial ground, gold hairline, eyebrow and serif
 * headline.
 *
 * The eyebrow, headline and promise are the page's `hero` section, edited in the
 * page builder. The chips come from the registry (`chips`), since they describe
 * what the tool does rather than page copy. With no hero section, the registry's
 * copy is the fallback. Any sections after the hero render normally.
 */
export function ToolHero({
  sections,
  fallback,
  chips = [],
}: {
  sections: PageSection[];
  fallback: { eyebrow: string; headline: string; tagline: string };
  chips?: string[];
}) {
  const first = sections[0];
  const hero = first?.section_type === 'hero' ? ((first.content ?? {}) as Record<string, unknown>) : null;
  const rest = hero ? sections.slice(1) : sections;

  const eyebrow = hero ? s(hero.badge_text) || s(hero.badge) : fallback.eyebrow;
  const headline = hero ? s(hero.headline) : fallback.headline;
  const subtitle = hero ? s(hero.subtitle) : `<p>${fallback.tagline}</p>`;

  return (
    <>
      <section
        data-hero
        className={`relative overflow-hidden ${PAGE_GUTTER} py-12 sm:py-14 lg:py-16`}
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #1F4269 0%, #1B3A5F 55%, #14304F 100%)',
          color: '#FFFFFF',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #C69C3E 0, #C69C3E 1px, transparent 1px, transparent 14px)',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full border border-[#C69C3E]/25" />
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full border border-[#C69C3E]/15" />
        <div className="relative mx-auto w-full max-w-[900px] text-center">
          <div aria-hidden className="mx-auto h-px w-[64px]" style={{ background: '#C69C3E' }} />
          {eyebrow && (
            <p className="mt-5 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.18em', color: '#C69C3E' }}>
              {eyebrow}
            </p>
          )}
          {headline && (
            <h1 className="pmbc-display mt-4 text-[32px] leading-[1.08] sm:text-[42px] lg:text-[50px]" style={{ color: '#FFFFFF', textWrap: 'balance' }}>
              {headline}
            </h1>
          )}
          <RichText
            html={subtitle}
            as="div"
            className="mx-auto mt-5 max-w-[680px] text-[16px] leading-[1.6] sm:text-[18px]"
            style={{ color: '#E8DDC4', textWrap: 'pretty' }}
          />
          {chips.length > 0 && (
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#C69C3E]/45 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white"
                >
                  <Check aria-hidden size={14} className="text-[#C69C3E]" />
                  {chip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {rest.length > 0 && <SectionList sections={rest} />}
    </>
  );
}
