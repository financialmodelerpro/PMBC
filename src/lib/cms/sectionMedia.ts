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
 *   media_position     left | right | above | below
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
]);

export function sectionTypeSupportsSharedMedia(sectionType: string): boolean {
  return !SECTION_TYPES_WITH_OWN_MEDIA.has(sectionType);
}

function readPosition(raw: unknown): MediaPosition {
  if (raw === 'left' || raw === 'right' || raw === 'above' || raw === 'below') {
    return raw;
  }
  // Below rather than above by default: a section leads with its own eyebrow
  // and headline, and dropping an image above those buries the point of the
  // section behind a picture.
  return 'below';
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
