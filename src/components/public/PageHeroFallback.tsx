/**
 * Default hero shown on a bespoke firm page when the CMS page has no `hero`
 * section yet — keeps the page from being blank-topped during content
 * population. Once an admin adds a hero block via the page builder, that
 * block takes over and this fallback is no longer rendered.
 *
 * The shape is deliberately understated: navy eyebrow, serif headline,
 * single tagline. No CTAs — bespoke pages should drive action through their
 * sections, not through the fallback hero.
 */
export function PageHeroFallback({
  eyebrow,
  headline,
  tagline,
}: {
  eyebrow: string;
  headline: string;
  tagline?: string;
}) {
  return (
    <section className="bg-white px-6 pt-20 pb-14 lg:pt-28 lg:pb-20">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#1B3A5F]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0F1B2D] sm:text-5xl lg:text-6xl">
          {headline}
        </h1>
        {tagline && (
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {tagline}
          </p>
        )}
        <div
          aria-hidden
          className="mx-auto mt-10 h-px w-16 bg-[#D4A93A]"
        />
      </div>
    </section>
  );
}
