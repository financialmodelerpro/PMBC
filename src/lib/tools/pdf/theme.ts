/**
 * The shared report theme for every tool PDF: colours, type, page geometry,
 * fonts, brand material and the legal line. The Business Valuation report is
 * the first user; the Investor Readiness Scorecard and any later tool report
 * import the same theme and the components in `components.tsx`, and supply only
 * their content and their report details.
 *
 * COLOURS come from the final letterhead, `reference/brand/PMBC_Letterhead.pdf`,
 * sampled on 2026-09-17 from its vector fill operators and from a 3x render,
 * and confirmed against the Header Settings logo file, which uses the same
 * navy, green and gold exactly:
 *   navy       #153D64   the letterhead bands, contact labels, the logo wordmark
 *   green      #2E8B3A   the swoosh, the logo's "Business Consultants"
 *   greenDeep  #1E5825   the darker shade inside the swoosh
 *   gold       #C9A227   the tagline, the logo ring
 *   grey       #595959   the letterhead's legal and contact text
 * The website still uses its earlier tokens (#1B3A5F, #3FA663, #C69C3E); the
 * results dashboard keeps those through the site chart palette.
 *
 * COLOUR RULES
 *   Navy is primary: headings, rules, table headers, actuals in charts.
 *   Green is the secondary accent: forecast series, free cash flow, positive
 *   indicators, section markers and small accent shapes.
 *   Gold is minimal: the tagline, the base case marker, and at most one small
 *   highlight on a page. No gold fills and no large gold text.
 *   Pages are white, tables use light neutral shading, warnings are red.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import fs from 'node:fs';
import path from 'node:path';

import { Font, StyleSheet } from '@react-pdf/renderer';

import { BRAND, DEFAULT_BRAND_NAME, DEFAULT_TAGLINE, LEGAL_LINE, NEUTRALS } from '../../brand/letterhead';
import type { PartnerCard } from '../brand/partner';
import type { ChartPalette } from '../valuation/charts';

/**
 * Report colours. Brand colours are the letterhead's; the neutrals (text,
 * borders, shading, the warning red) are chosen to sit quietly beside them.
 */
export const RC = {
  ...BRAND,
  ...NEUTRALS,
  muted: BRAND.grey,
} as const;

export { BRAND, DEFAULT_BRAND_NAME, DEFAULT_TAGLINE, LEGAL_LINE };

/** The chart palette for reports: navy actuals, green forecasts, gold only for the base case marker. */
export const REPORT_CHART_PALETTE: ChartPalette = {
  text: RC.text,
  muted: RC.muted,
  border: RC.border,
  white: RC.white,
  track: RC.shade,
  bar: RC.navy,
  blend: RC.green,
  scenario: RC.greenDeep,
  marker: RC.white,
  blendMarker: RC.gold,
  totalStart: RC.navy,
  totalEnd: RC.greenDeep,
  add: RC.green,
  less: RC.warning,
  revenueActual: RC.navy,
  revenueForecast: RC.green,
  ebitdaActual: '#7F97B1',
  ebitdaForecast: '#8CC196',
  forecastOpacity: 1,
  negative: RC.warning,
  marginLine: RC.navy,
  forecastCaption: RC.green,
  heatLow: RC.white,
  heatMid: '#C5D1DE',
  heatHigh: RC.navy,
  heatOutline: RC.gold,
  heatEmpty: RC.shade,
  heatWhiteTextFrom: 0.72,
  rangeTrack: RC.navyTint,
  rangeLabel: RC.text,
  rangeBaseLabel: RC.navy,
  rangeMarker: RC.gold,
  ebitda: RC.navy,
  fcf: RC.green,
  revenueLine: RC.navy,
  ebitdaLine: RC.green,
  rangeTrackOpacity: 1,
};

/**
 * Source Serif 4 substitutes single glyphs for "fi" and "fl", so "Free cash
 * flow" was set with a ligature that some viewers draw poorly and that copies
 * out as "Free cash ow". Ligatures are off everywhere in the report. Inter has
 * none to turn off. Checked by extracting the PDF text in verify-tool-email-pdf.
 */
export const NO_LIGATURES = { liga: false, clig: false };

let fontsRegistered = false;
export function registerFonts(): void {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), 'src', 'lib', 'tools', 'pdf', 'fonts');
  Font.register({
    family: 'Inter',
    fonts: [
      { src: path.join(dir, 'inter-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(dir, 'inter-latin-500-normal.woff'), fontWeight: 500 },
      { src: path.join(dir, 'inter-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  Font.register({
    family: 'SourceSerif',
    fonts: [
      { src: path.join(dir, 'source-serif-4-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(dir, 'source-serif-4-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  // Words are never hyphenated. Figures like "SAR 1.25 billion" must not break.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const PAGE_WIDTH = 595;

/**
 * A4 is 595 by 842 points. Inner pages start content at `contentTop`, under a
 * thin navy rule at `ruleTop`; the footer sits in the bottom margin.
 */
export const PAGE = {
  width: PAGE_WIDTH,
  height: 842,
  marginX: 44,
  contentWidth: 507,
  ruleTop: 24,
  contentTop: 36,
  contentBottom: 56,
  footerBottom: 20,
} as const;

/** Type scale. Body text never goes below 8.5pt, table text never below 7.5pt. */
export const TYPE = {
  pageTitle: 19,
  h2: 14,
  subHead: 11,
  body: 9,
  small: 8.5,
  table: 8,
  tableHead: 7.5,
  caption: 7.5,
} as const;

/**
 * The letterhead's header and footer bands, measured from the vector paths in
 * `reference/brand/PMBC_Letterhead.pdf`. The letterhead is drawn in an 816 by
 * 1056 unit space (US Letter at 0.75 points a unit); these are its numbers, and
 * `LH_SCALE` maps them onto an A4 page width. Used by the cover and the closing
 * page only. Inner pages never carry the letterhead.
 */
export const LETTERHEAD = {
  width: 816,
  height: 1056,
  /** Header: the green band's top, the navy rule's top and bottom. */
  bandTop: 81.76,
  ruleTop: 118.88,
  bandBottom: 127.52,
  /** Leading edge of each header shape at the band's bottom: two shaded swooshes, then solid green. */
  headerShapes: [399.52, 476, 558.72],
  /** The curve each swoosh rises along, from its bottom point to the band's top, as offsets. */
  curve: [
    [0, 0], [35.2, -31.2], [38.56, -33.92], [41.92, -36.32], [45.44, -38.4], [49.12, -40.32], [52.96, -41.92],
    [56.96, -43.2], [60.8, -44.32], [64.96, -44.96], [69.28, -45.44], [73.44, -45.6],
  ] as [number, number][],
  /** The logo's ink box and the tagline's right edge and baseline. */
  logo: { x: 43.5, y: 38, height: 54.5 },
  tagline: { right: 777, baseline: 69.8, size: 15 },
  /** The shaded swooshes run from the brand green to this darker green, sampled from a 3x render. */
  shade: '#24702E',
} as const;

export const LH_SCALE = PAGE_WIDTH / LETTERHEAD.width;

/** Logo files are trimmed and about 5.2 to 1. Height is set, width follows. */
export const LOGO_RATIO = 6113 / 1176;

/** Everything a report draws from the CMS and site settings. Every piece is optional. */
export type ReportBranding = {
  /** The colour logo from Header Settings, trimmed and resized, never recoloured. PNG. For white pages. */
  logo: Buffer | null;
  /** The white logo from Header Settings, for any dark background, so the logo is always visible. PNG. */
  logoOnDark?: Buffer | null;
  partner: PartnerCard | null;
  /** The partner portrait, resized to 360 by 450. JPEG. */
  partnerPhoto: Buffer | null;
  brandName?: string | null;
  tagline?: string | null;
  contact?: ReportContact | null;
};

/** Contact details for the closing page, from site settings. */
export type ReportContact = { email: string | null; advisoryEmail: string | null; website: string; location: string | null };

/** What every report page footer and the cover say about this report. */
export type ReportDetails = {
  /** The tool's name, from the tool registry. */
  toolName: string;
  /** The company the report is about, or the person it was prepared for. */
  subject: string;
  /** The date the report's figures are as at, already formatted. */
  dateLabel: string;
};

/**
 * The Header Settings logos, as bundled copies: `brand/logo.png` (the colour
 * logo, trimmed, 900 wide, flattened on white) and `brand/logo-white.png` (the
 * white logo, trimmed, 900 wide). A report draws the live files from Header
 * Settings when `fetchReportBranding` supplies them, and these otherwise, so a
 * failed fetch or a render without branding still shows the logo rather than
 * the brand name in type. Refresh them when Header Settings changes the logo.
 */
const bundledLogos: { logo?: Buffer | null; logoOnDark?: Buffer | null } = {};
export function bundledLogo(kind: 'logo' | 'logoOnDark'): Buffer | null {
  if (bundledLogos[kind] === undefined) {
    const file = path.join(process.cwd(), 'src', 'lib', 'tools', 'pdf', 'brand', kind === 'logo' ? 'logo.png' : 'logo-white.png');
    try {
      bundledLogos[kind] = fs.readFileSync(file);
    } catch {
      bundledLogos[kind] = null;
    }
  }
  return bundledLogos[kind] ?? null;
}

export function withBrandDefaults(b: ReportBranding | null | undefined, siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.pacemakersglobal.com') {
  const website = (b?.contact?.website || siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    logo: b?.logo ?? bundledLogo('logo'),
    logoOnDark: b?.logoOnDark ?? bundledLogo('logoOnDark'),
    partner: b?.partner ?? null,
    partnerPhoto: b?.partnerPhoto ?? null,
    brandName: b?.brandName || DEFAULT_BRAND_NAME,
    tagline: b?.tagline || DEFAULT_TAGLINE,
    contact: {
      email: b?.contact?.email ?? null,
      advisoryEmail: b?.contact?.advisoryEmail ?? null,
      website: website.startsWith('www.') ? website : `www.${website}`,
      location: b?.contact?.location ?? null,
    },
  };
}

export type ResolvedBrand = ReturnType<typeof withBrandDefaults>;

export const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontFeatureSettings: NO_LIGATURES,
    fontSize: TYPE.body,
    color: RC.text,
    paddingTop: PAGE.contentTop,
    paddingBottom: PAGE.contentBottom,
    paddingHorizontal: PAGE.marginX,
    backgroundColor: RC.white,
  },
  eyebrow: { fontSize: TYPE.caption, fontWeight: 600, letterSpacing: 1.4, color: RC.green, textTransform: 'uppercase' },
  h1: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 22, lineHeight: 1.15, color: RC.navy },
  h2: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: TYPE.h2, color: RC.navy, marginBottom: 3 },
  sub: { fontSize: TYPE.small, color: RC.muted, marginBottom: 8, lineHeight: 1.45 },
  body: { fontSize: TYPE.body, lineHeight: 1.5, color: RC.text },
  note: { fontSize: TYPE.small, color: RC.muted, lineHeight: 1.45, marginTop: 4 },
  pageTitle: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: TYPE.pageTitle, color: RC.navy, marginBottom: 12 },
});
