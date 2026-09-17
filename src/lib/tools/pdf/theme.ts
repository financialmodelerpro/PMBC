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

import { BRAND, DEFAULT_BRAND_NAME, DEFAULT_TAGLINE, LEGAL_LINE, NEUTRALS, SITE_ADDRESS } from '../../brand/letterhead';
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
 * The letterhead header, measured from the vector paths and a 3x render of
 * `reference/brand/PMBC Letterhead 09172026.pdf` (US Letter, 612 by 792 points).
 * Distances here are in the letterhead's points, from the top of the page;
 * `LH_SCALE` maps them onto A4 width, applied to both directions so nothing is
 * stretched.
 *
 *   navy bar     full width at the very top edge
 *   swoosh       three copies of one shape hanging from the bar on the right:
 *                two shaded, then solid green, each shifted right
 *   logo         top left, below the bar (its visible ink box)
 * The letterhead file also prints the tagline below the swoosh; reports do not.
 * The tagline appears in the report footer only.
 */
export const LETTERHEAD = {
  width: 612,
  barHeight: 7.07,
  swooshBottom: 37.2,
  /** Where each shape's diagonal edge meets the top of the page. */
  shapeStarts: [304.85, 362.71, 425.25],
  /**
   * One shape's outline from its top left corner, as offsets: down the diagonal
   * edge to the curve, around the curve to the bottom edge. The shape then runs
   * right, past the page edge, and back to the top.
   */
  edge: [
    [0, 0], [26.67, 25.4], [29.11, 27.57], [31.71, 29.53], [34.36, 31.27], [37.17, 32.79], [40.08, 34.15],
    [43.04, 35.19], [46.11, 36.06], [49.23, 36.66], [52.4, 37.04], [55.62, 37.2],
  ] as [number, number][],
  /** Each shaded shape runs from the brand green at its edge to this darker green, sampled from the render. */
  shadeLight: '#2E8A3A',
  shadeDark: '#23682B',
  logo: { x: 33, top: 19.3, bottom: 60 },
} as const;

export const LH_SCALE = PAGE_WIDTH / LETTERHEAD.width;

/**
 * Width over height of a PNG or JPEG, read from the file itself, so a logo is
 * always drawn at its own proportions. Falls back to the Header Settings
 * logo's proportions when the file cannot be read.
 */
export function imageRatio(file: Buffer | null | undefined): number {
  const fallback = 6123 / 1175;
  if (!file || file.length < 24) return fallback;
  if (file[0] === 0x89 && file.toString('latin1', 1, 4) === 'PNG') {
    const w = file.readUInt32BE(16), h = file.readUInt32BE(20);
    return w > 0 && h > 0 ? w / h : fallback;
  }
  if (file[0] === 0xff && file[1] === 0xd8) {
    let i = 2;
    while (i + 9 < file.length) {
      if (file[i] !== 0xff) return fallback;
      const marker = file[i + 1];
      const len = file.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        const h = file.readUInt16BE(i + 5), w = file.readUInt16BE(i + 7);
        return w > 0 && h > 0 ? w / h : fallback;
      }
      i += 2 + len;
    }
  }
  return fallback;
}

/** The image format react-pdf needs, or null when the file is neither PNG nor JPEG. */
export function imageFormat(file: Buffer | null | undefined): 'png' | 'jpg' | null {
  if (!file || file.length < 4) return null;
  if (file[0] === 0x89 && file.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (file[0] === 0xff && file[1] === 0xd8) return 'jpg';
  return null;
}

/** Everything a report draws from the CMS and site settings. Every piece is optional. */
export type ReportBranding = {
  /** The colour logo file from Header Settings, exactly as stored: not resized, traced or recoloured. For white pages. */
  logo: Buffer | null;
  /** The white logo file from Header Settings, exactly as stored, for any dark background. */
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
 * The Header Settings logos, as bundled byte-for-byte copies of the stored
 * files: `brand/logo.png` (the colour logo) and `brand/logo-white.png` (the
 * white logo), not resized or altered. A report draws the live files from Header
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

export function withBrandDefaults(b: ReportBranding | null | undefined) {
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
      // Always the live address: a local or preview render must not print its own host.
      website: SITE_ADDRESS,
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
