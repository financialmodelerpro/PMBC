import Image from 'next/image';

import { shouldBypassOptimizer, resolveMediaType } from '@/lib/media';

/**
 * Optional photographic background for a hero section (`hero` and
 * `founder_hero`), set in the page builder. Three content keys:
 *
 *   hero_bg_image    image URL from the Media Library; empty means none
 *   hero_bg_overlay  navy overlay opacity, 35 to 100, default 60
 *   hero_bg_focal    'center' | 'top' | 'bottom', default 'center'
 *
 * With no image the hero renders exactly as it did before this existed:
 * `readHeroBackground` returns null and nothing here is drawn.
 */

export const HERO_OVERLAY_MIN = 35;
export const HERO_OVERLAY_MAX = 100;
export const HERO_OVERLAY_DEFAULT = 60;

export type HeroFocal = 'center' | 'top' | 'bottom';

export const HERO_FOCAL_OPTIONS: Array<{ value: HeroFocal; label: string }> = [
  { value: 'center', label: 'Centre' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

const FOCAL_POSITION: Record<HeroFocal, string> = {
  center: '50% 50%',
  top: '50% 0%',
  bottom: '50% 100%',
};

export type HeroBackgroundValue = {
  url: string;
  /** 0.35 to 1. */
  opacity: number;
  focal: HeroFocal;
};

/** The overlay value an editor should show: stored, clamped, or the default. */
export function heroOverlayPercent(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return HERO_OVERLAY_DEFAULT;
  return Math.min(HERO_OVERLAY_MAX, Math.max(HERO_OVERLAY_MIN, Math.round(n)));
}

export function heroFocal(v: unknown): HeroFocal {
  return v === 'top' || v === 'bottom' ? v : 'center';
}

/**
 * The hero's background, or null when no usable image is set. Only https URLs
 * and site-relative paths are accepted, and a video URL is ignored: this slot is
 * a still image behind text.
 */
export function readHeroBackground(content: Record<string, unknown> | null | undefined): HeroBackgroundValue | null {
  const raw = typeof content?.hero_bg_image === 'string' ? content.hero_bg_image.trim() : '';
  if (!raw || !(/^https:\/\//i.test(raw) || raw.startsWith('/'))) return null;
  if (resolveMediaType(raw, undefined) === 'video') return null;
  return {
    url: raw,
    opacity: heroOverlayPercent(content?.hero_bg_overlay) / 100,
    focal: heroFocal(content?.hero_bg_focal),
  };
}

/**
 * The image and its navy overlay, absolutely filling the hero behind its
 * content. The parent must be positioned, and the content after it must be
 * positioned too so it paints above. The image covers the hero (cropped, never
 * distorted) and is decorative, so its alt is empty.
 */
export function HeroBackground({ bg }: { bg: HeroBackgroundValue }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        src={bg.url}
        alt=""
        fill
        priority
        sizes="100vw"
        unoptimized={shouldBypassOptimizer(bg.url, resolveMediaType(bg.url, undefined))}
        className="object-cover"
        style={{ objectPosition: FOCAL_POSITION[bg.focal] }}
      />
      <div className="absolute inset-0" style={{ background: '#14304F', opacity: bg.opacity }} />
    </div>
  );
}
