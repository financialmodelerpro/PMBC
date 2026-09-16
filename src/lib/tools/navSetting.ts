/**
 * The Tools nav item, as an operator controls it in Pages & Nav.
 *
 * TWO SWITCHES, EACH WITH ONE JOB
 *   - Pages & Nav (`site_pages`, the row whose link is /tools) decides whether
 *     Tools is offered in the navbar at all, under what label and where. It
 *     ships hidden (migration 081). The footer "Free Tools" link follows it.
 *   - Tools (`tool_visibility`, /admin/tools) decides whether each tool page is
 *     public, and so whether the hub has anything to show.
 *
 * The item reaches the public only when both agree: switched on in Pages & Nav
 * AND at least one tool Live. Switched on with nothing Live, the public sees no
 * link (the hub would 404), signed-in staff see it with a Hidden badge so they
 * can check it, and Pages & Nav shows a warning beside the row.
 *
 * Pure, with no imports, so the admin page in the browser, the server and
 * `verify-tools-visibility` all use the same rules.
 */

export const TOOLS_HUB_HREF = '/tools';

export function normaliseHref(href: string): string {
  return href.trim().replace(/\/+$/, '').toLowerCase() || '/';
}

export function isToolsHubHref(href: string): boolean {
  return normaliseHref(href) === TOOLS_HUB_HREF;
}

/**
 * The navbar items with the Tools rule applied. `items` are the visible Pages &
 * Nav rows, so a Tools item is present only when an operator switched it on.
 * Nothing is ever added here.
 */
export function applyToolsNavSetting<I extends { href: string; badge?: string }>(
  items: I[],
  liveToolCount: number,
  isStaff: boolean,
): I[] {
  if (liveToolCount > 0) return items;
  return items.flatMap((item) => {
    if (!isToolsHubHref(item.href)) return [item];
    return isStaff ? [{ ...item, badge: 'Hidden' }] : [];
  });
}

/** Whether the navbar needs to know who is asking: only while Tools is on and nothing is Live. */
export function toolsNavNeedsSession(items: { href: string }[], liveToolCount: number): boolean {
  return liveToolCount === 0 && items.some((i) => isToolsHubHref(i.href));
}

export type ToolsNavNotice =
  | { tone: 'warning'; text: string }
  | { tone: 'info'; text: string }
  | null;

/** The note Pages & Nav shows beside the Tools row. Null for every other row. */
export function toolsNavNotice(row: { href: string; visible: boolean }, liveToolCount: number): ToolsNavNotice {
  if (!isToolsHubHref(row.href)) return null;
  if (row.visible && liveToolCount === 0) {
    return {
      tone: 'warning',
      text: 'Switched on, but no tool is Live. The public sees no Tools link and /tools returns 404; signed-in admins see the link with a Hidden badge.',
    };
  }
  if (row.visible) {
    return { tone: 'info', text: `Shown in the navbar and footer. ${liveToolCount === 1 ? '1 tool is' : `${liveToolCount} tools are`} Live.` };
  }
  return { tone: 'info', text: 'Hidden from the navbar and footer. Each tool page still follows its own Live or Hidden status.' };
}
