import { RichText } from '@/components/public/RichText';
import { SectionList } from '@/components/public/SectionRenderer';
import type { PageSection } from '@/lib/cms/pages';
import { PAGE_GUTTER } from '@/lib/public/layout';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * The opening of a tool page: a compact version of the site hero.
 *
 * Every other page shares the 70vh hero in HERO_FRAME. A tool page is the
 * exception on purpose, since the visitor came to use the calculator, and at
 * 70vh its first step began below the fold on a laptop. The treatment is
 * otherwise the site's: the same navy radial ground, gold hairline, eyebrow and
 * serif headline, at a smaller scale and with no scroll cue.
 *
 * The copy is still the page's `hero` section, edited in the page builder. The
 * first section is read here rather than rendered through the registry, which
 * would give it the full-height frame; any sections after it render normally.
 * With no hero section, the registry's copy is the fallback.
 */
export function ToolHero({
  sections,
  fallback,
}: {
  sections: PageSection[];
  fallback: { eyebrow: string; headline: string; tagline: string };
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
        className={`relative ${PAGE_GUTTER} py-12 sm:py-14 lg:py-16`}
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1F4269 0%, #1B3A5F 55%, #14304F 100%)',
          color: '#FFFFFF',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #C69C3E 0, #C69C3E 1px, transparent 1px, transparent 14px)',
          }}
        />
        <div className="relative mx-auto w-full max-w-[900px] text-center">
          <div aria-hidden className="mx-auto h-px w-[64px]" style={{ background: '#C69C3E' }} />
          {eyebrow && (
            <p className="mt-5 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.18em', color: '#C69C3E' }}>
              {eyebrow}
            </p>
          )}
          {headline && (
            <h1
              className="pmbc-display mt-4 text-[32px] leading-[1.08] sm:text-[42px] lg:text-[50px]"
              style={{ color: '#FFFFFF', textWrap: 'balance' }}
            >
              {headline}
            </h1>
          )}
          <RichText
            html={subtitle}
            as="div"
            className="mx-auto mt-5 max-w-[720px] text-[16px] leading-[1.65] sm:text-[18px]"
            style={{ color: '#E8DDC4', textWrap: 'pretty' }}
          />
        </div>
      </section>
      {rest.length > 0 && <SectionList sections={rest} />}
    </>
  );
}
