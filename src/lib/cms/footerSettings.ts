/**
 * Footer presentation settings, stored as discrete `footer_settings` rows in
 * `cms_content` alongside the existing `about_blurb` / `address_line` /
 * `copyright` copy keys.
 *
 * Deliberately a pure parser over an already-fetched row map rather than its own
 * fetcher: `FooterServer` already reads the whole `footer_settings` section for
 * the copy keys, so parsing that same map costs no extra query.
 */

import { z } from 'zod';

/** Shipped defaults. Also the floor a missing or malformed value falls back to. */
export const FOOTER_LOGO_HEIGHT_DEFAULT = 48;
export const FOOTER_LOGO_HEIGHT_MIN = 24;
export const FOOTER_LOGO_HEIGHT_MAX = 120;

export type FooterConfig = {
  /** Rendered height in px. Always a usable number, never 0. */
  logo_height_px: number;
  /** Explicit width in px, or null for automatic width by aspect ratio. */
  logo_width_px: number | null;
  logo_enabled: boolean;
};

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  logo_height_px: FOOTER_LOGO_HEIGHT_DEFAULT,
  logo_width_px: null,
  logo_enabled: true,
};

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

/**
 * A stored pixel value to a usable number.
 *
 * Blank, non-numeric and zero all fall back rather than reaching the renderer.
 * A zero-height logo is invisible with no error anywhere, which is the single
 * worst outcome for this setting: the operator sees a footer with no logo and
 * no explanation. The API rejects out-of-range input with a 422, but a row
 * hand-edited in /admin/content or the SQL editor bypasses that, so the read
 * path clamps as well rather than trusting the write path.
 */
function parseHeight(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return FOOTER_LOGO_HEIGHT_DEFAULT;
  return Math.min(FOOTER_LOGO_HEIGHT_MAX, Math.max(FOOTER_LOGO_HEIGHT_MIN, n));
}

/** Width is genuinely optional: blank means auto, so blank returns null, not a default. */
function parseWidth(raw: string | undefined): number | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Write-side validation for /api/admin/footer-settings.
 *
 * Lives here rather than in the route for two reasons: it shares the MIN/MAX
 * constants with the read-path clamp above, so the two can never drift, and a
 * Next.js route file may only export route handlers, so a schema exported from
 * there would break the build (this repo has hit that once already).
 *
 * Height is required and bounded. Values arrive as strings because cms_content
 * is TEXT throughout, but unlike the header's pixel fields blank is NOT
 * meaningful: a footer logo must have a height, and an empty one renders
 * nothing. Blank and non-numeric are rejected rather than coerced, so the
 * operator finds out at save time instead of discovering an invisible logo on
 * the live site.
 */
export const footerLogoHeightSchema = z
  .string()
  .regex(/^\d+$/, 'must be a whole number of pixels')
  .refine((v) => {
    const n = Number.parseInt(v, 10);
    return n >= FOOTER_LOGO_HEIGHT_MIN && n <= FOOTER_LOGO_HEIGHT_MAX;
  }, `must be between ${FOOTER_LOGO_HEIGHT_MIN} and ${FOOTER_LOGO_HEIGHT_MAX} pixels`);

/** Width is genuinely optional: blank means automatic width from the aspect ratio. */
export const footerLogoWidthSchema = z
  .string()
  .regex(/^\d*$/, 'must be a whole number of pixels, or blank for auto')
  .refine((v) => v === '' || Number.parseInt(v, 10) > 0, 'must be greater than zero');

export const footerSettingsSchema = z.object({
  footer_logo_height_px: footerLogoHeightSchema.optional(),
  footer_logo_width_px: footerLogoWidthSchema.optional(),
  footer_logo_enabled: z.boolean().optional(),
});

export function parseFooterConfig(
  rows: Record<string, string | undefined>,
): FooterConfig {
  return {
    logo_height_px: parseHeight(rows.footer_logo_height_px),
    logo_width_px: parseWidth(rows.footer_logo_width_px),
    logo_enabled: parseBool(rows.footer_logo_enabled, DEFAULT_FOOTER_CONFIG.logo_enabled),
  };
}
