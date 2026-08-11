import { Media } from './Media';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';
import type { MediaValue } from '@/lib/media';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

/**
 * What the frame needs, which is less than a positioned section media value.
 *
 * `position` is widened to a string here on purpose: the frame only stamps it
 * onto `data-section-media` for identification, and the standalone `media`
 * section has no position relative to any text. Keeping `MediaPosition` narrow
 * matters more, since that union drives the admin control and the layout
 * branch, and adding a value there that neither honours would be misleading.
 */
export type FrameMedia = MediaValue & { position: string; caption: string };

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

  const beside = media.position === 'left' || media.position === 'right';
  const frame = (
    <SectionMediaFrame
      media={media}
      variant={variant}
      // The frame fills its grid column, so the browser needs the column width,
      // not the container width. Beside the text that column is 45% of the
      // 1200px inner box less the gap, which lands near 500px; stacked it is
      // the full inner box.
      sizes={
        beside
          ? '(min-width: 1024px) 520px, 92vw'
          : '(min-width: 1264px) 1200px, 92vw'
      }
    />
  );

  if (beside) {
    const mediaLeft = media.position === 'left';
    return (
      // Two real columns from lg up, 55/45 text to media, vertically centred on
      // each other. `lg` matches the breakpoint `text_image` already uses, so
      // the two side-by-side layouts on the site break at the same width.
      //
      // Both class strings are written out in full rather than composed, since
      // Tailwind scans source text and would not see an interpolated one.
      //
      // Below lg this collapses to a single column and, because the text is
      // first in the DOM, the media follows it for both sides. Ordering is done
      // with `order` at lg only, so the mobile stack never has to be re-sorted:
      // a section leads with its own words on a narrow screen, and an image
      // pushed above them would bury the point of the section.
      <div
        className={
          'grid items-center gap-12 lg:gap-16 ' +
          (mediaLeft ? 'lg:grid-cols-[45fr_55fr]' : 'lg:grid-cols-[55fr_45fr]')
        }
      >
        <div className={mediaLeft ? 'lg:order-2' : 'lg:order-1'}>{children}</div>
        <div className={mediaLeft ? 'lg:order-1' : 'lg:order-2'}>{frame}</div>
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
 * Deliberately not an aspect-ratio box, and deliberately not width-capped. The
 * dedicated media slots crop to a fixed ratio because they are portraits and
 * logos in a known layout; a general-purpose section image could be a chart, a
 * screenshot or a wide photograph, and cropping those to 4:5 would destroy
 * them. The asset keeps its own proportions, and the frame takes the width of
 * whatever column it is placed in.
 */
export function SectionMediaFrame({
  media,
  variant,
  sizes = '(min-width: 1264px) 1200px, 92vw',
}: {
  media: FrameMedia;
  variant: PmbcVariant;
  /** Responsive width hint. Set by the layout, which knows the column width. */
  sizes?: string;
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
            sizes={sizes}
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
