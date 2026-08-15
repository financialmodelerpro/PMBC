/**
 * Destinations that are offered only once they have something to show.
 *
 * /team is a real page with a real route, but it is fed entirely by the
 * `team_members` table. While that table is empty the page is a hero over the
 * words "profiles are being prepared", and pointing the navbar and the footer at
 * that is a worse first impression than not offering it at all.
 *
 * WHY THIS IS DERIVED RATHER THAN A SWITCH
 * The same reasoning the sitemap already uses (see src/app/sitemap.ts): whether
 * a page has content is a fact about the data, so asking the data is the honest
 * coupling and it reverses itself. The first profile written in /admin/team puts
 * the link back in both places with no code change and no one remembering to
 * flip anything.
 *
 * The operator switches still exist and still win. A `site_pages` row hidden in
 * Pages & Nav stays hidden, and a footer link set to invisible in Footer Links
 * stays invisible, whatever this returns. This gate can only take a link away,
 * never add one back.
 *
 * COST
 * One count-only query per page render, shared by the navbar and the footer
 * through a single call site each. Case Studies and Insights are deliberately
 * not gated here: both ship with their footer links hidden anyway, so gating
 * them would buy two more queries on every render and change nothing that
 * renders today. Adding one is a line in `fetchSuppressedNavHrefs` when either
 * link is turned on.
 */

import { countVisibleTeam } from '@/lib/cms/collections';

/** The /team route, named once so the gate and the seeds cannot drift. */
export const TEAM_HREF = '/team';

/**
 * The hrefs that must not be offered on this render.
 *
 * A Set rather than an array because both callers do membership tests over a
 * list they are already iterating.
 */
export async function fetchSuppressedNavHrefs(): Promise<Set<string>> {
  const suppressed = new Set<string>();
  if ((await countVisibleTeam()) === 0) suppressed.add(TEAM_HREF);
  return suppressed;
}

/**
 * Normalises an href for comparison against the gated set.
 *
 * Operators type these by hand in two admin tables, so a trailing slash or a
 * stray capital is likely enough to be worth absorbing here rather than leaving
 * a link that the gate silently fails to catch.
 */
export function normaliseHref(href: string): string {
  const trimmed = href.trim().toLowerCase();
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1);
  return trimmed;
}

/** True when this href points at a destination with nothing on it yet. */
export function isSuppressed(href: string, suppressed: Set<string>): boolean {
  return suppressed.has(normaliseHref(href));
}
