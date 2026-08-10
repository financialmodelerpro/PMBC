import { Media } from './Media';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

/**
 * Places a section's optional shared media around that section's own content.
 *
 * The single most important behaviour is the null case: with no media set this
 * returns `children` untouched, adding no wrapper element, no grid and no
 * margin. Every page that existed before this feature renders byte-identically.
 *
 * Used from two places, so the four positions behave the same everywhere:
 * `SectionContainer` (which every section type except the hero renders inside)
 * and `Hero` (which owns its own full-bleed section and gradient).
 */
export function SectionMediaLayout({
  media,
  variant,
  children,
}: {
  media: SectionMediaValue | null;
  variant: PmbcVariant;
  children: React.ReactNode;
}) {
  if (!media) return <>{children}</>;

  const frame = <SectionMediaFrame media={media} variant={variant} />;

  if (media.position === 'left' || media.position === 'right') {
    const mediaFirst = media.position === 'left';
    return (
      // Single column below lg, where a side-by-side split would squeeze both
      // halves. The media leads on narrow screens regardless of side, matching
      // how `text_image` already behaves.
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className={mediaFirst ? 'lg:order-1' : 'lg:order-2'}>{frame}</div>
        <div className={mediaFirst ? 'lg:order-2' : 'lg:order-1'}>{children}</div>
      </div>
    );
  }

  if (media.position === 'above') {
    return (
      <>
        <div className="mb-14">{frame}</div>
        {children}
      </>
    );
  }

  return (
    <>
      {children}
      <div className="mt-14">{frame}</div>
    </>
  );
}

/**
 * The frame itself: PMBC's gold hairline offset from the asset, with the navy
 * accent corner used on the founder portraits, and a small-caps caption.
 *
 * Deliberately not an aspect-ratio box. The dedicated media slots crop to a
 * fixed ratio because they are portraits and logos in a known layout; a
 * general-purpose section image could be a chart, a screenshot or a wide
 * photograph, and cropping those to 4:5 would destroy them. The asset keeps its
 * own proportions and the frame follows.
 */
export function SectionMediaFrame({
  media,
  variant,
}: {
  media: SectionMediaValue;
  variant: PmbcVariant;
}) {
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    // `data-section-media` marks this as a CMS-driven shared media frame.
    // `figure` alone is not enough to identify one: `quote` uses figure and
    // figcaption for a pull quote with no image, which is semantically correct
    // and must not be mistaken for an empty media frame.
    <figure className="relative" data-section-media={media.position}>
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-2 border"
          style={{ borderColor: '#C69C3E' }}
        />
        <div
          aria-hidden
          className="absolute -right-2 -bottom-2 h-8 w-8"
          style={{ background: dark ? '#C69C3E' : '#1B3A5F' }}
        />
        <div
          className="relative overflow-hidden"
          style={{ background: dark ? 'rgba(255,255,255,0.04)' : v.cardBg }}
        >
          <Media
            src={media.url}
            alt={media.caption || ''}
            mediaType={media.mediaType}
            posterUrl={media.posterUrl}
            autoplay={media.autoplay}
            loop={media.loop}
            controls={media.controls}
            width={1200}
            height={800}
            sizes="(min-width: 1024px) 600px, 90vw"
            className="h-auto w-full"
          />
        </div>
      </div>
      {media.caption && (
        <figcaption
          className="mt-6 text-[11px] font-semibold uppercase"
          style={{
            letterSpacing: '0.16em',
            color: dark ? 'rgba(232, 221, 196, 0.75)' : v.textMuted,
          }}
        >
          {media.caption}
        </figcaption>
      )}
    </figure>
  );
}
