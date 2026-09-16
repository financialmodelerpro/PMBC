/**
 * The partner a tool visitor would work with, as shown on the results page and
 * in the PDF report.
 *
 * Every word comes from the founder profile the page builder already edits:
 * the `founder_hero` section on /about/ahmad-din for identity and introduction,
 * and the `founder_block` card on home for the career highlights. Nothing here
 * is a second copy of the bio, so an edit in the builder reaches the report.
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

export type PartnerCard = {
  name: string;
  /** "Founding Partner". */
  role: string;
  /** The primary title line, such as "Corporate Finance and Transaction Advisory Specialist". */
  title: string;
  /** "ACCA | FMVA | AFM | 12+ Years Experience". */
  credentialsLine: string;
  /** One paragraph. */
  intro: string;
  /** Career highlights, at most five. */
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

/**
 * Builds the card from the two sections' stored content. Null without a name,
 * in which case both surfaces leave the block out rather than show a frame.
 */
export function partnerFromSections(hero: Record<string, unknown> | null, block: Record<string, unknown> | null): PartnerCard | null {
  const name = text(hero?.name) || text(block?.name);
  if (!name) return null;
  const highlights = (Array.isArray(block?.credentials) ? block.credentials : [])
    .map(text)
    .filter(Boolean)
    .slice(0, 5);
  const heroLinkedin = url(hero?.cta_primary_href);
  return {
    name,
    role: text(hero?.eyebrow) || 'Founding Partner',
    title: text(hero?.title_primary),
    credentialsLine: text(hero?.credentials_line) || text(block?.credentials_line),
    intro: text(hero?.intro),
    highlights,
    photoUrl: url(hero?.photo_url) || url(block?.photo_url),
    profilePath: publicPathForPageSlug(PARTNER_PAGE_SLUG),
    linkedinUrl: heroLinkedin && /linkedin\.com/i.test(heroLinkedin) ? heroLinkedin : null,
  };
}
