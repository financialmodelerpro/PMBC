/**
 * Fonts, colours and base styles for the PDF report.
 */

import path from 'node:path';

import { Font, StyleSheet } from '@react-pdf/renderer';

import { CHART_COLORS } from '../valuation/charts';

export const C = CHART_COLORS;

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

/** A4 is 595 by 842 points. Content width inside the side margins. */
export const PAGE = { width: 595, height: 842, marginX: 44, contentWidth: 507 } as const;

export const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontFeatureSettings: NO_LIGATURES,
    fontSize: 9.5,
    color: C.text,
    paddingTop: 50,
    paddingBottom: 58,
    paddingHorizontal: PAGE.marginX,
    backgroundColor: C.white,
  },
  brandBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: C.navy },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: PAGE.marginX,
    right: PAGE.marginX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  eyebrow: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, color: C.goldMuted, textTransform: 'uppercase' },
  h1: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 24, lineHeight: 1.15, color: C.text },
  h2: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 14.5, color: C.text, marginBottom: 3 },
  sub: { fontSize: 8.5, color: C.muted, marginBottom: 9, lineHeight: 1.45 },
  body: { fontSize: 9.5, lineHeight: 1.55, color: C.text },
  section: { marginBottom: 18 },
  note: { fontSize: 8, color: C.muted, lineHeight: 1.5, marginTop: 6 },
  rule: { height: 1, width: 40, backgroundColor: C.gold, marginBottom: 9 },
  pageTitle: { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 20, color: C.text, marginBottom: 14 },
});
