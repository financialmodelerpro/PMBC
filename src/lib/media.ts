/**
 * Shared media vocabulary for the admin uploader and the public renderers.
 *
 * One module rather than two, because the two sides have to agree exactly:
 * whatever the upload route accepts, a renderer has to be able to display, and
 * whatever the field writes, a renderer has to be able to read back.
 */

export type MediaType = 'image' | 'gif' | 'video';

/** Extensions we render as a still image through `next/image`. */
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg']);
/** Extensions we render as an animated image (optimizer bypassed). */
const ANIMATED_EXT = new Set(['gif']);
/** Extensions we render as an HTML5 `<video>`. */
const VIDEO_EXT = new Set(['mp4', 'webm']);

export const IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const;

export const VIDEO_MIME = ['video/mp4', 'video/webm'] as const;

/** Non-media file the library has always accepted. Kept so uploads do not regress. */
export const DOCUMENT_MIME = ['application/pdf'] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

/** `accept` attribute for a file input that takes anything the library stores. */
export const MEDIA_ACCEPT = [...IMAGE_MIME, ...VIDEO_MIME, ...DOCUMENT_MIME].join(',');

/** `accept` for slots that genuinely cannot show a video, such as a CSS background. */
export const IMAGE_ONLY_ACCEPT = IMAGE_MIME.join(',');

export function isVideoMime(mime: string): boolean {
  return (VIDEO_MIME as readonly string[]).includes(mime);
}

/**
 * Lowercased file extension, with any query string or fragment removed first.
 * Supabase public URLs are clean, but an operator pasting an external URL will
 * often bring `?w=1200` along with it, and that would otherwise defeat every
 * extension check below.
 */
export function extensionOf(url: string): string {
  if (!url) return '';
  const withoutQuery = url.split(/[?#]/)[0];
  const lastSlash = withoutQuery.lastIndexOf('/');
  const name = lastSlash >= 0 ? withoutQuery.slice(lastSlash + 1) : withoutQuery;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Best guess from the URL alone. Used for content stored before media_type existed. */
export function detectMediaType(url: string): MediaType {
  const ext = extensionOf(url);
  if (VIDEO_EXT.has(ext)) return 'video';
  if (ANIMATED_EXT.has(ext)) return 'gif';
  return 'image';
}

/**
 * The stored `media_type` wins when it is a value we understand, otherwise fall
 * back to sniffing the extension.
 *
 * The stored value has to win rather than merely act as a hint, because an
 * animated WebP is indistinguishable from a still one by extension. An operator
 * marking it animated is the only signal available, and ignoring that would
 * freeze the animation with no way to fix it.
 */
export function resolveMediaType(url: string, stored?: unknown): MediaType {
  if (stored === 'image' || stored === 'gif' || stored === 'video') return stored;
  return detectMediaType(url);
}

/**
 * Whether `next/image` must be bypassed for this asset.
 *
 * Two separate reasons, both of which produce a broken render rather than a
 * merely suboptimal one:
 *  - animated formats lose their animation when the optimizer re-encodes them,
 *  - SVG is refused by the optimizer unless `dangerouslyAllowSVG` is set, which
 *    this project deliberately does not set.
 */
export function shouldBypassOptimizer(url: string, type: MediaType): boolean {
  return type === 'gif' || extensionOf(url) === 'svg';
}

/**
 * Companion content keys for a media slot, derived from its URL key.
 *
 *   image_url -> image_media_type, image_poster_url, image_autoplay, ...
 *   photo_url -> photo_media_type, ...
 *
 * Derived rather than fixed, because `network_partners` stores one media slot
 * per partner and `text_image` may later gain a second. A single bare
 * `media_type` key would collide the moment a section carries two.
 */
export function mediaKeys(urlKey: string) {
  const base = urlKey.replace(/_url$/, '');
  return {
    url: urlKey,
    // The shared section-level slot is keyed `media_url`, and deriving from it
    // would give `media_media_type`. Special-cased to the plain `media_type`,
    // which is also the name the shared-media schema documents.
    mediaType: base === 'media' ? 'media_type' : `${base}_media_type`,
    poster: `${base}_poster_url`,
    autoplay: `${base}_autoplay`,
    loop: `${base}_loop`,
    controls: `${base}_controls`,
  } as const;
}

export type MediaValue = {
  url: string;
  mediaType: MediaType;
  posterUrl: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

/**
 * Reads a media slot out of a section's content blob.
 *
 * A bare `media_type` is accepted as a fallback so content written by hand
 * against the simpler shape still resolves, but the prefixed key is what gets
 * written back.
 */
export function readMediaValue(
  content: Record<string, unknown>,
  urlKey: string,
): MediaValue {
  const k = mediaKeys(urlKey);
  const url = str(content[k.url]);
  return {
    url,
    mediaType: resolveMediaType(url, content[k.mediaType] ?? content.media_type),
    posterUrl: str(content[k.poster]),
    // Autoplay and loop default on: a muted background clip that needs a click
    // to start is not what any of these slots want. Controls default off.
    autoplay: bool(content[k.autoplay], true),
    loop: bool(content[k.loop], true),
    controls: bool(content[k.controls], false),
  };
}

/** The patch to merge back into content after a media field change. */
export function mediaValuePatch(
  urlKey: string,
  value: MediaValue,
): Record<string, unknown> {
  const k = mediaKeys(urlKey);
  return {
    [k.url]: value.url,
    [k.mediaType]: value.mediaType,
    [k.poster]: value.posterUrl,
    [k.autoplay]: value.autoplay,
    [k.loop]: value.loop,
    [k.controls]: value.controls,
  };
}
