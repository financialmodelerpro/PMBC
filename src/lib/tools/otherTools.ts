/**
 * "Try our other free tools" on each tool page.
 *
 * The public sees the other Live tools, in registry order, so a new tool is
 * offered on every existing tool page the moment it is switched Live at
 * /admin/tools, with no further change. Signed-in staff previewing a page also
 * see ready tools that are still Hidden, marked as such, so the section can be
 * checked before a tool goes Live. Draft tools are never offered. With nothing
 * to offer the section renders nothing, rather than an empty band.
 *
 * Pure: the tool page and `verify-tools-visibility` share it.
 */

import type { ToolWithVisibility, VisibilitySnapshot } from './visibility';

export function otherToolsFor(snapshot: VisibilitySnapshot, currentSlug: string, opts: { staff: boolean }): ToolWithVisibility[] {
  return snapshot.tools.filter((t) => t.slug !== currentSlug && t.build === 'ready' && (t.live || opts.staff));
}
