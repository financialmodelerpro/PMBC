import { SectionContainer, SectionIntro } from '../SectionContainer';
import { SectionMediaFrame } from '../SectionMediaLayout';
import { readMediaValue } from '@/lib/media';
import type { PmbcVariant } from '@/lib/public/tokens';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Content width of the standalone frame, as a share of the 1200px container. */
const WIDTHS = {
  full: { className: '', maxWidth: undefined as number | undefined },
  wide: { className: 'mx-auto', maxWidth: 960 },
  narrow: { className: 'mx-auto', maxWidth: 720 },
} as const;

type MediaWidth = keyof typeof WIDTHS;

function readWidth(raw: unknown): MediaWidth {
  return raw === 'wide' || raw === 'narrow' || raw === 'full' ? raw : 'full';
}

/**
 * A section that is nothing but one image, GIF or video.
 *
 * Distinct from the shared media panel every other section carries. That panel
 * attaches an asset TO a section, so the asset belongs to that section's copy
 * and moves with it. This is an asset that belongs to the page: it sits in the
 * section order, it can be dragged between any two sections, and it owns its
 * own background variant and vertical padding rather than inheriting a
 * neighbour's.
 *
 * The practical difference shows up when an animation is the point rather than
 * an illustration of a nearby paragraph. Attaching one to the section above it
 * makes the ordering a lie: reorder that section and the animation follows it.
 *
 * An empty `media_url` renders nothing at all, not an empty frame. A section
 * that an operator has added but not yet filled should be invisible on the
 * public page, exactly as a `paragraphs` section with no body is.
 */
export function MediaSection({
  content,
  styles,
  variant = 'white',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = content ?? {};
  const url = s(c.media_url).trim();
  if (!url) return null;

  const base = readMediaValue(c, 'media_url');
  const media = {
    ...base,
    // The frame type wants a position. Nothing here is positioned relative to
    // text, so it is reported as its own block, which is also what the
    // `data-section-media` attribute will carry.
    position: 'standalone' as const,
    caption: s(c.media_caption),
  };

  const eyebrow = s(c.eyebrow);
  const heading = s(c.heading);
  const width = readWidth(c.width);
  const box = WIDTHS[width];

  return (
    <SectionContainer variant={variant} styles={styles} size="compact">
      {(eyebrow || heading) && (
        <div className="mb-12">
          <SectionIntro eyebrow={eyebrow} headline={heading} variant={variant} />
        </div>
      )}
      <div className={box.className} style={box.maxWidth ? { maxWidth: box.maxWidth } : undefined}>
        <SectionMediaFrame
          media={media}
          variant={variant}
          sizes={
            width === 'narrow'
              ? '(min-width: 784px) 720px, 92vw'
              : width === 'wide'
                ? '(min-width: 1024px) 960px, 92vw'
                : '(min-width: 1264px) 1200px, 92vw'
          }
        />
      </div>
    </SectionContainer>
  );
}
