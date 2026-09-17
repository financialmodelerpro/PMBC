/**
 * Server-side brand material for the tool report and results page: the logos
 * from Header Settings (`branding_config`) and the partner card from the
 * founder profile sections.
 *
 * The stored files are sized for the web (the logos are about 6,100 pixels
 * wide and the portrait is 2.4 MB), so images for the PDF are fetched once,
 * resized with sharp, and kept in memory for ten minutes. A report emailed as
 * an attachment stays small, and a warm function does not refetch per lead.
 *
 * Never throws. Any missing row, failed fetch or unreadable image comes back as
 * null, and the report falls back to the text wordmark and leaves the partner
 * block out. A lead's email must never fail because a logo did not load.
 */

import sharp from 'sharp';

import { fetchBranding } from '@/lib/cms/branding';
import { FOUNDER_PAGE_SLUG } from '@/lib/cms/founderProfile';
import { PORTRAIT_RATIO, portraitCrop } from '@/lib/public/portrait';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { ReportBranding } from '../pdf/ValuationReport';
import { partnerFromHero, type PartnerCard } from './partner';

const TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;
const cache = new Map<string, { at: number; value: Buffer | null }>();

async function sectionContent(pageSlug: string, type: string): Promise<Record<string, unknown> | null> {
  const { data } = await createSupabaseServerClient()
    .from('page_sections')
    .select('content')
    .eq('page_slug', pageSlug)
    .eq('section_type', type)
    .eq('visible', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.content as Record<string, unknown> | null) ?? null;
}

/** The partner card, or null when the profile has no name or cannot be read. */
export async function fetchPartnerCard(): Promise<PartnerCard | null> {
  try {
    return partnerFromHero(await sectionContent(FOUNDER_PAGE_SLUG, 'founder_hero'));
  } catch {
    return null;
  }
}

/**
 * The portrait for the PDF, 360 by 450 (4:5): scaled to cover the frame, then
 * cropped at the shared face-anchored focus (`src/lib/public/portrait.ts`), so it
 * is never stretched. The report draws it in a box of the same proportions.
 */
async function portrait(input: Buffer): Promise<Buffer> {
  const img = sharp(input).rotate();
  const meta = await img.metadata();
  const upright = (meta.orientation ?? 1) >= 5;
  const w = (upright ? meta.height : meta.width) ?? PORTRAIT_OUT.width;
  const h = (upright ? meta.width : meta.height) ?? PORTRAIT_OUT.height;
  const crop = portraitCrop(w, h, PORTRAIT_OUT.width, PORTRAIT_OUT.height);
  return img
    .resize({ width: crop.width, height: crop.height, fit: 'fill' })
    .extract({ left: crop.left, top: crop.top, width: PORTRAIT_OUT.width, height: PORTRAIT_OUT.height })
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: 84 })
    .toBuffer();
}

/** Output size of the report portrait, in pixels. */
export const PORTRAIT_OUT = { width: 360, height: Math.round(360 / PORTRAIT_RATIO) };

/** Fetches an image and resizes it, cached by URL and treatment. Null on any failure. */
async function processedImage(src: string | null, kind: 'logo' | 'portrait'): Promise<Buffer | null> {
  if (!src || !/^https:\/\//i.test(src)) return null;
  const key = `${kind}:${src}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: Buffer | null = null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.ok) {
      const input = Buffer.from(await res.arrayBuffer());
      const logo = async () => sharp(input).trim().resize({ width: 900, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      value = kind === 'logo' ? await logo() : await portrait(input);
    }
  } catch (err) {
    console.error(`[tool-brand] ${kind} image unavailable:`, err instanceof Error ? err.message : err);
    value = null;
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Everything the PDF report draws from the CMS. */
export async function fetchReportBranding(): Promise<ReportBranding> {
  const [branding, partner] = await Promise.all([fetchBranding().catch(() => null), fetchPartnerCard()]);
  // The same fallback chain the navbar uses: the on-dark file when there is one.
  const onDarkSrc = branding?.logo_dark_url || branding?.logo_url || null;
  // The closing page uses the colour logo exactly as Header Settings stores it
  // for the header: trimmed and resized only, never recoloured.
  const onLightSrc = branding?.logo_url || null;
  const [logoOnDark, logoOnLight, partnerPhoto] = await Promise.all([
    processedImage(onDarkSrc, 'logo'),
    processedImage(onLightSrc, 'logo'),
    processedImage(partner?.photoUrl ?? null, 'portrait'),
  ]);
  return { logoOnDark, logoOnLight, partner, partnerPhoto };
}
