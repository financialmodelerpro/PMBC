import { createSupabaseServerClient } from '@/lib/supabase/server';

export type NavItem = { label: string; href: string };

export type HeaderConfig = {
  nav_items: NavItem[];
  cta_label: string;
  cta_href: string;
  show_cta: boolean;
  mobile_menu_enabled: boolean;
};

export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  nav_items: [
    { label: 'Services', href: '/services' },
    { label: 'Sectors', href: '/sectors' },
    { label: 'Approach', href: '/approach' },
    { label: 'Network', href: '/network' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  cta_label: 'Start a Conversation',
  cta_href: '/contact',
  show_cta: true,
  mobile_menu_enabled: true,
};

function parseBool(v: string | null | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

function parseNavItems(v: string | null | undefined): NavItem[] | null {
  if (!v) return null;
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return null;
    const items: NavItem[] = [];
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const label = typeof o.label === 'string' ? o.label : '';
      const href = typeof o.href === 'string' ? o.href : '';
      if (label && href) items.push({ label, href });
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/**
 * Reads header settings from discrete cms_content rows under section
 * 'header_settings':
 *   - nav_items (JSON array)
 *   - cta_label, cta_href (text)
 *   - show_cta, mobile_menu_enabled (text 'true'|'false')
 *
 * Falls back to DEFAULT_HEADER_CONFIG for any missing/malformed key.
 */
export async function fetchHeaderConfig(): Promise<HeaderConfig> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', 'header_settings');

  const rows = new Map<string, string | null>();
  for (const r of data ?? []) {
    rows.set(r.key, r.value);
  }

  // Backwards-compat: if a legacy `config` row still exists, honour it as a
  // last resort. The 009 migration drops it, but admins on stale databases
  // should still see correct nav.
  let legacy: Partial<HeaderConfig> | null = null;
  const legacyJson = rows.get('config');
  if (legacyJson) {
    try {
      legacy = JSON.parse(legacyJson) as Partial<HeaderConfig>;
    } catch {
      legacy = null;
    }
  }

  const nav = parseNavItems(rows.get('nav_items') ?? null);
  return {
    nav_items:
      nav ??
      (Array.isArray(legacy?.nav_items) && legacy.nav_items.length > 0
        ? legacy.nav_items
        : DEFAULT_HEADER_CONFIG.nav_items),
    cta_label:
      rows.get('cta_label') ?? legacy?.cta_label ?? DEFAULT_HEADER_CONFIG.cta_label,
    cta_href:
      rows.get('cta_href') ?? legacy?.cta_href ?? DEFAULT_HEADER_CONFIG.cta_href,
    show_cta: parseBool(
      rows.get('show_cta'),
      legacy?.show_cta ?? DEFAULT_HEADER_CONFIG.show_cta,
    ),
    mobile_menu_enabled: parseBool(
      rows.get('mobile_menu_enabled'),
      legacy?.mobile_menu_enabled ?? DEFAULT_HEADER_CONFIG.mobile_menu_enabled,
    ),
  };
}
