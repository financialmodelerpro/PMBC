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
 *   media_max_height   optional ceiling in pixels (blank means natural height)
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
  /** Pixel ceiling on the rendered height. Null means the asset's own height. */
  maxHeight: number | null;
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
  // These four are the odd case out: they carry no media field of their own and
  // render no asset at all. Two are page bodies, a form and a calendar; the
  // others are a card grid and a quote grid. None has anywhere for an image to
  // go. Offering the shared panel would give an operator an upload control with
  // no effect, which is the same trap by a different route.
  'contact_body',
  'booking_body',
  'service_grid',
  'testimonials',
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
 * Content key holding the optional pixel ceiling on a media frame's height.
 *
 * Named as a companion of `media_url` like every other key in this set, so the
 * standalone `media` section and the shared panel read and write the same
 * field. A video shot in portrait, or a tall screenshot, otherwise renders at
 * the full width of its column and overruns the viewport.
 */
export const MEDIA_MAX_HEIGHT_KEY = 'media_max_height';

/**
 * Bounds on the stored value.
 *
 * The floor exists because a frame small enough to be unreadable is never what
 * an operator meant, and a stray keystroke ("4" while typing "480") should not
 * be able to produce one. The ceiling is above any plausible viewport height,
 * so it only catches a value typed in the wrong unit.
 */
export const MIN_MEDIA_MAX_HEIGHT = 80;
export const MAX_MEDIA_MAX_HEIGHT = 1600;

/**
 * Quick picks, so the common case is one click rather than a guessed number.
 *
 * The values are chosen against viewport height rather than against any asset:
 * the whole point of the control is that the frame fits on screen alongside the
 * section's own text, and a laptop viewport is around 750px of usable height.
 * `null` clears the ceiling.
 */
export const MEDIA_MAX_HEIGHT_PRESETS: {
  value: number | null;
  label: string;
  hint: string;
}[] = [
  { value: null, label: 'Natural', hint: 'No ceiling. The asset keeps its own height.' },
  { value: 320, label: 'Short', hint: '320px. A band, comfortably inside any viewport.' },
  { value: 480, label: 'Medium', hint: '480px. Fits a laptop screen with room for the text.' },
  { value: 640, label: 'Tall', hint: '640px. Most of a laptop screen.' },
];

/**
 * Reads the ceiling, returning null for every value that cannot drive one.
 *
 * Blank, absent, non-numeric and zero all mean "natural height", which is the
 * state every section shipped in and must stay the state they render in. Out of
 * range values are clamped rather than rejected, so a mistyped ceiling still
 * produces a visible frame instead of a collapsed or unbounded one.
 */
export function readMediaMaxHeight(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.trim())
        : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(
    Math.min(Math.max(n, MIN_MEDIA_MAX_HEIGHT), MAX_MEDIA_MAX_HEIGHT),
  );
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
    maxHeight: readMediaMaxHeight(c[MEDIA_MAX_HEIGHT_KEY]),
  };
}
