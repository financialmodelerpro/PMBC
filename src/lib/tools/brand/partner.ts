/**
 * The partner a tool visitor would work with, as shown on the results page and
 * in the PDF report.
 *
 * Every word comes from ONE place: the `founder_hero` section on the founder
 * profile (/about/ahmad-din), edited in the page builder. Identity, title,
 * credentials and introduction are the fields that page already shows. The
 * career highlights are a separate field on the same section,
 * `report_highlights` (one per line), which the public profile page does not
 * render. It ships empty, so no highlight appears until one is written and
 * confirmed there; home's founder card is deliberately not read, so editing it
 * can never change a report.
 *
 * The highlights are the partner's career record, earned before and alongside
 * PaceMakers, and are labelled as his (`PARTNER_RECORD_NOTE`), never as the
 * firm's. CLAUDE.md, Critical Reminder 3.
 *
 * Pure, so `verify-tool-email-pdf` can prove the mapping without a database.
 */

import { publicPathForPageSlug } from '@/lib/cms/pageRoutes';

/**
 * Equal to `FOUNDER_PAGE_SLUG` in `src/lib/cms/founderProfile.ts`, which is not
 * imported because it brings the Supabase server client with it and this file
 * is also used in the browser. `verify-tool-email-pdf` asserts the two match.
 */
export const PARTNER_PAGE_SLUG = 'about-ahmad-din';

export const MAX_REPORT_HIGHLIGHTS = 5;

export type PartnerCard = {
  name: string;
  /** "Founding Partner". */
  role: string;
  /** The primary title line, such as "Corporate Finance and Transaction Advisory Specialist". */
  title: string;
  /** "ACCA | FMVA | AFM | 12+ Years Experience", with the separators spaced evenly. */
  credentialsLine: string;
  /** One paragraph. */
  intro: string;
  /** Career highlights from `report_highlights`, at most five. Empty until written. */
  highlights: string[];
  photoUrl: string | null;
  profilePath: string;
  linkedinUrl: string | null;
};

export const PARTNER_RECORD_NOTE = 'Career record, earned across senior roles before and alongside PaceMakers.';

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const url = (v: unknown): string | null => {
  const s = text(v);
  return /^https:\/\//i.test(s) ? s : null;
};

/** "ACCA | FMVA | AFM |12+ Years" becomes "ACCA | FMVA | AFM | 12+ Years". */
export function spaceSeparators(line: string): string {
  return line.replace(/\s*\|\s*/g, ' | ').trim();
}

/** The highlights field, one per line, or a list. Blank lines dropped, at most five. */
export function reportHighlights(v: unknown): string[] {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
  return items.map(text).filter(Boolean).slice(0, MAX_REPORT_HIGHLIGHTS);
}

/**
 * Builds the card from the founder profile's hero content. Null without a name,
 * in which case both surfaces leave the block out rather than show a frame.
 */
export function partnerFromHero(hero: Record<string, unknown> | null): PartnerCard | null {
  const name = text(hero?.name);
  if (!name) return null;
  const linkedin = url(hero?.cta_primary_href);
  return {
    name,
    role: text(hero?.eyebrow) || 'Founding Partner',
    title: text(hero?.title_primary),
    credentialsLine: spaceSeparators(text(hero?.credentials_line)),
    intro: text(hero?.intro),
    highlights: reportHighlights(hero?.report_highlights),
    photoUrl: url(hero?.photo_url),
    profilePath: publicPathForPageSlug(PARTNER_PAGE_SLUG),
    linkedinUrl: linkedin && /linkedin\.com/i.test(linkedin) ? linkedin : null,
  };
}
