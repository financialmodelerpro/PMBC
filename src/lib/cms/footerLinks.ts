/**
 * The footer's navigation links, stored as one JSON array in `cms_content`
 * under `(footer_settings, links)` and edited at /admin/footer-links.
 *
 * WHY A JSON ARRAY RATHER THAN A TABLE
 * Pages and Nav is a table (`site_pages`, migration 027), and this list is its
 * footer counterpart, so a `footer_links` table would have been the closer
 * mirror. It is not one because creating a table is DDL, supabase-js cannot run
 * DDL, and this repository has no direct Postgres connection string: 031, 032
 * and 033 all had to be pasted into the Supabase SQL editor by hand. A
 * visibility control that only starts working after someone runs SQL is not a
 * control that has been delivered. A list value under an existing section is
 * DML, so the seed script applies it, and `(header_settings, nav_items)` is the
 * standing precedent for a naturally-list-shaped value living in one row.
 *
 * The trade this accepts: writes replace the whole array rather than one row,
 * so one audit entry covers a change instead of one per link. For a list of
 * eight links edited by one person that is the better side of the trade.
 */

import { z } from 'zod';

/**
 * Which footer column a link belongs to.
 *
 * Two rather than one because Book a Meeting sits under the contact details
 * rather than in the Firm list, and hard-coding that one exception would mean
 * the admin table could not express where a link actually renders.
 */
export type FooterLinkColumn = 'firm' | 'contact';

export type FooterLink = {
  id: string;
  label: string;
  href: string;
  column: FooterLinkColumn;
  visible: boolean;
};

export const FOOTER_LINK_COLUMNS: { value: FooterLinkColumn; label: string }[] = [
  { value: 'firm', label: 'Firm' },
  { value: 'contact', label: 'Contact' },
];

/**
 * What the footer renders when the stored value is missing or unreadable.
 *
 * Case Studies, Insights and Team ship hidden: all three collections are empty,
 * and a linked page that opens onto an empty state is a weaker impression than
 * no link. They are one switch from returning once there is something on them.
 */
export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { id: 'services', label: 'Services', href: '/services', column: 'firm', visible: true },
  { id: 'network', label: 'Network', href: '/network', column: 'firm', visible: true },
  { id: 'sectors', label: 'Sectors', href: '/sectors', column: 'firm', visible: true },
  { id: 'case-studies', label: 'Case Studies', href: '/case-studies', column: 'firm', visible: false },
  { id: 'insights', label: 'Insights', href: '/insights', column: 'firm', visible: false },
  { id: 'team', label: 'Team', href: '/team', column: 'firm', visible: false },
  { id: 'fmp', label: 'Financial Modeler Pro', href: '/fmp', column: 'firm', visible: true },
  { id: 'contact', label: 'Contact', href: '/contact', column: 'firm', visible: true },
  { id: 'book', label: 'Book a Meeting', href: '/book', column: 'contact', visible: true },
];

/** Write-side shape. Shared by the API route so the two cannot drift. */
export const footerLinkSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(300),
  column: z.enum(['firm', 'contact']),
  visible: z.boolean(),
});

export const footerLinksSchema = z.array(footerLinkSchema).max(40);

function isColumn(v: unknown): v is FooterLinkColumn {
  return v === 'firm' || v === 'contact';
}

/**
 * A stored JSON string to a usable list.
 *
 * Forgiving by design, because this runs on every public page render and the
 * value can be hand-edited in /admin/content or the SQL editor. A malformed
 * entry is dropped rather than throwing, and a value that yields nothing at all
 * falls back to the shipped list: a footer with no links is a broken footer
 * with no error anywhere, which is the one outcome worth guarding against.
 *
 * An operator hiding every link is a different case and is honoured, since the
 * entries still parse.
 */
export function parseFooterLinks(raw: string | null | undefined): FooterLink[] {
  if (!raw || !raw.trim()) return DEFAULT_FOOTER_LINKS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_FOOTER_LINKS;
  }
  if (!Array.isArray(parsed)) return DEFAULT_FOOTER_LINKS;

  const links: FooterLink[] = [];
  parsed.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as Record<string, unknown>;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    const href = typeof e.href === 'string' ? e.href.trim() : '';
    if (!label || !href) return;
    links.push({
      // A missing id is synthesised rather than rejected: it is a key for the
      // admin table, not something the reader ever sees.
      id: typeof e.id === 'string' && e.id.trim() ? e.id.trim() : `link-${i}-${href}`,
      label,
      href,
      column: isColumn(e.column) ? e.column : 'firm',
      visible: e.visible !== false,
    });
  });

  return links.length > 0 ? links : DEFAULT_FOOTER_LINKS;
}

export function serializeFooterLinks(links: FooterLink[]): string {
  return JSON.stringify(links);
}

/** The visible links for one column, in stored order. */
export function footerLinksFor(links: FooterLink[], column: FooterLinkColumn): FooterLink[] {
  return links.filter((l) => l.column === column && l.visible);
}
