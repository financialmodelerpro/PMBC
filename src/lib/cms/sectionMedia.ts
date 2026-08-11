import { readMediaValue, type MediaValue } from '@/lib/media';

/**
 * Optional media that any section type can carry, independent of its own
 * content shape.
 *
 * Stored on `page_sections.content` under a fixed set of keys, so one admin
 * panel and one renderer path serve every section type rather than each editor
 * growing its own image field:
 *
 *   media_url          the asset
 *   media_type         image | gif | video (see lib/media.ts)
 *   media_poster_url   still frame for video
 *   media_position     left | right | above | below (defaults to right)
 *   media_caption      optional caption under the frame
 *   media_autoplay / media_loop / media_controls   video playback
 *
 * Absent or blank `media_url` means the section renders exactly as it did
 * before this existed. That is the whole contract: adding the capability must
 * not add a gap, a placeholder, or a wrapper element to any existing page.
 */

export type MediaPosition = 'left' | 'right' | 'above' | 'below';

export type SectionMediaValue = MediaValue & {
  position: MediaPosition;
  caption: string;
};

/**
 * Section types that already carry their own media field, and are therefore
 * excluded from the shared panel and the shared render path.
 *
 * Giving these two media slots would be a trap: an operator would have no way
 * to tell which one drives the image they can see, and the section's bespoke
 * layout (a founder portrait in a 4:5 gold frame, a partner logo row) is the
 * point of those types. Their existing field stays the only one.
 */
export const SECTION_TYPES_WITH_OWN_MEDIA: ReadonlySet<string> = new Set([
  'text_image',
  'founder_block',
  'founder_hero',
  'network_partners',
  'fmp_intro',
  'quote',
  // The standalone media section IS its media. It reuses the same `media_url`
  // keys, so mounting the shared panel beside its own editor would show two
  // controls writing the same field, which is worse than the two-competing-
  // images problem the rest of this list exists to prevent.
  'media',
]);

export function sectionTypeSupportsSharedMedia(sectionType: string): boolean {
  return !SECTION_TYPES_WITH_OWN_MEDIA.has(sectionType);
}

/**
 * Where media lands when the operator has not chosen a side.
 *
 * Right rather than below. Beside the text is the useful case: it fills the
 * horizontal space the 1200px container already has, and keeps the section a
 * readable height. Stacked full width is the exception, worth choosing
 * deliberately for a wide chart or a screenshot that needs the room.
 *
 * Right rather than left, because the section's eyebrow, headline and opening
 * line all start at the left edge, and putting the image there pushes the
 * reader's entry point into the middle of the section.
 *
 * Exported so the admin panel and the renderer cannot drift: a panel showing
 * one default while the page renders another is worse than either choice.
 */
export const DEFAULT_MEDIA_POSITION: MediaPosition = 'right';

export function readPosition(raw: unknown): MediaPosition {
  if (raw === 'left' || raw === 'right' || raw === 'above' || raw === 'below') {
    return raw;
  }
  return DEFAULT_MEDIA_POSITION;
}

/**
 * Returns null when no media is set, which callers treat as "render the
 * section exactly as before" rather than "render an empty frame".
 */
export function readSectionMedia(
  content: Record<string, unknown> | null | undefined,
): SectionMediaValue | null {
  const c = content ?? {};
  const base = readMediaValue(c, 'media_url');
  if (!base.url.trim()) return null;
  return {
    ...base,
    position: readPosition(c.media_position),
    caption: typeof c.media_caption === 'string' ? c.media_caption : '',
  };
}
