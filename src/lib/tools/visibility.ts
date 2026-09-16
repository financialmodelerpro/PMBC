/**
 * Whether each free tool is public. The single answer every public surface asks.
 *
 * A tool is Live only when BOTH are true:
 *   - the registry marks it `build: 'ready'` (the code exists and works), and
 *   - its `tool_visibility` row says `live` (someone switched it on at /admin/tools).
 *
 * Anything else is Hidden: a draft, a ready tool with no row, a row saying
 * `hidden`, and every tool when the table is missing or the read fails. Hidden
 * is the failure mode on purpose. A tool shown by accident links a stranger to
 * something unfinished; a tool hidden by accident costs a switch.
 *
 * THE SURFACES THAT OBEY THIS, and nothing else decides them:
 *   - /tools/[slug]         404 and noindex when Hidden (staff see an Admin preview)
 *   - /tools                404 when no tool is Live; lists Live tools only
 *   - sitemap.xml           /tools and each Live tool
 *   - WebApplication JSON-LD, rendered only on a Live tool's public page
 *   - navbar "Tools"        Pages & Nav decides; shown to the public only while a tool is Live (navSetting.ts)
 *   - footer "Free Tools"   follows the Pages & Nav Tools row, and only while a tool is Live
 *   - service page CTA      a tool's `serviceCta`, shown only while it is Live
 *   - the lead API          refuses a Hidden tool unless the caller is staff
 *
 * `resolveVisibility` is pure so `npm run verify-tools-visibility` can prove
 * those rules without a database.
 */

import { TOOLS, type ToolEntry } from '@/config/tools';

import { isMissingSchema, toolsDb, type ToolVisibilityRow, type ToolVisibilityStatus } from './db';
import { TOOLS_HUB_HREF, isToolsHubHref, normaliseHref } from './navSetting';

export type VisibilityRead =
  | { ok: true; rows: ToolVisibilityRow[] }
  | { ok: false; reason: 'missing_table' | 'error'; message?: string };

export type ToolWithVisibility = ToolEntry & {
  /** What the public sees. */
  live: boolean;
  /** What the database row says, before the registry is applied. Null when there is no row. */
  stored: ToolVisibilityStatus | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type VisibilitySnapshot = {
  tools: ToolWithVisibility[];
  /** Why every tool is Hidden, when the read itself failed. Null on a clean read. */
  problem: 'missing_table' | 'error' | null;
};

export function resolveVisibility(read: VisibilityRead, registry: ToolEntry[] = TOOLS): VisibilitySnapshot {
  const bySlug = new Map<string, ToolVisibilityRow>();
  if (read.ok) for (const r of read.rows) bySlug.set(r.slug, r);
  return {
    problem: read.ok ? null : read.reason,
    tools: registry.map((t) => {
      const row = bySlug.get(t.slug);
      const stored = row && (row.status === 'live' || row.status === 'hidden') ? row.status : null;
      return {
        ...t,
        live: read.ok && t.build === 'ready' && stored === 'live',
        stored,
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
      };
    }),
  };
}

/**
 * LOCAL VERIFICATION ONLY. `TOOLS_VISIBILITY_OVERRIDE=hidden` or `=live` makes a
 * local build behave as if every tool were Hidden or Live, without writing to
 * the shared database that local builds read. Ignored whenever `VERCEL` is set,
 * which Vercel sets on every preview and production deployment, so it can never
 * change what the public sees.
 */
function localOverride(): VisibilityRead | null {
  if (process.env.VERCEL) return null;
  const v = process.env.TOOLS_VISIBILITY_OVERRIDE;
  if (v === 'hidden') return { ok: true, rows: [] };
  if (v === 'live') {
    return { ok: true, rows: TOOLS.map((t) => ({ slug: t.slug, status: 'live' as const, updated_at: null, updated_by: null })) };
  }
  return null;
}

export async function readVisibilityRows(): Promise<VisibilityRead> {
  const override = localOverride();
  if (override) return override;
  try {
    const { data, error } = await toolsDb().from('tool_visibility').select('slug, status, updated_at, updated_by');
    if (error) {
      return isMissingSchema(error)
        ? { ok: false, reason: 'missing_table' }
        : { ok: false, reason: 'error', message: error.message };
    }
    return { ok: true, rows: (data ?? []) as ToolVisibilityRow[] };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'read failed' };
  }
}

export async function fetchToolVisibility(): Promise<VisibilitySnapshot> {
  return resolveVisibility(await readVisibilityRows());
}

export function liveToolsFrom(snapshot: VisibilitySnapshot): ToolWithVisibility[] {
  return snapshot.tools.filter((t) => t.live);
}

export function findToolIn(snapshot: VisibilitySnapshot, slug: string): ToolWithVisibility | null {
  return snapshot.tools.find((t) => t.slug === slug) ?? null;
}

/** The sitemap paths the tools contribute: the hub while anything is Live, and each Live tool. */
export function toolSitemapPaths(snapshot: VisibilitySnapshot): string[] {
  const live = liveToolsFrom(snapshot);
  if (live.length === 0) return [];
  return ['/tools', ...live.map((t) => `/tools/${t.slug}`)];
}

/**
 * The footer links with Free Tools applied. Any stored `/tools` link is removed
 * (Footer Links is not a second switch), and the registry's link is added after
 * Financial Modeler Pro only while the Pages & Nav Tools row is switched on AND
 * at least one tool is Live, so the footer never links to a 404.
 */
export function applyToolsFooterLink<L extends { id: string; href: string; label: string; column: string; visible: boolean }>(
  links: L[],
  snapshot: VisibilitySnapshot,
  toolsLink: { id: string; label: string; href: string },
  navOn: boolean,
): L[] {
  const withoutStored = links.filter((l) => normaliseHref(l.href) !== normaliseHref(toolsLink.href));
  if (!navOn || liveToolsFrom(snapshot).length === 0) return withoutStored;
  const at = withoutStored.findIndex((l) => l.href === '/fmp');
  const entry = { id: toolsLink.id, label: toolsLink.label, href: toolsLink.href, column: 'firm', visible: true } as L;
  const out = [...withoutStored];
  out.splice(at === -1 ? out.length : at + 1, 0, entry);
  return out;
}

/**
 * LOCAL VERIFICATION ONLY. `TOOLS_NAV_OVERRIDE=on` or `=off` makes a local build
 * behave as if the Pages & Nav Tools row were switched on (placed after
 * Financial Modeler Pro) or off, without writing to the shared database.
 * Ignored whenever `VERCEL` is set, like `TOOLS_VISIBILITY_OVERRIDE`.
 */
export function localToolsNavOverride(): 'on' | 'off' | null {
  if (process.env.VERCEL) return null;
  const v = process.env.TOOLS_NAV_OVERRIDE;
  return v === 'on' || v === 'off' ? v : null;
}

/** Visible Pages & Nav items with the local override applied. A no-op on Vercel. */
export function withLocalToolsNavOverride<I extends { label: string; href: string }>(items: I[]): I[] {
  const o = localToolsNavOverride();
  if (!o) return items;
  const without = items.filter((i) => !isToolsHubHref(i.href));
  if (o === 'off') return without;
  const at = without.findIndex((i) => normaliseHref(i.href) === '/fmp');
  const out = [...without];
  out.splice(at === -1 ? out.length : at + 1, 0, { label: 'Tools', href: TOOLS_HUB_HREF } as I);
  return out;
}

/** Whether the Pages & Nav Tools row is switched on. Off when it is absent, hidden or unreadable. */
export async function fetchToolsNavOn(): Promise<boolean> {
  const o = localToolsNavOverride();
  if (o) return o === 'on';
  try {
    const { data, error } = await toolsDb().from('site_pages').select('href, visible').eq('visible', true);
    if (error) return false;
    return (data ?? []).some((r: { href: string }) => isToolsHubHref(r.href));
  } catch {
    return false;
  }
}

/** The Live tools that promote themselves on a given service page. */
export function serviceCtasFor(snapshot: VisibilitySnapshot, serviceSlug: string): ToolWithVisibility[] {
  return liveToolsFrom(snapshot).filter((t) => t.serviceCta?.serviceSlug === serviceSlug);
}
