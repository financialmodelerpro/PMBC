import { createSupabaseServerClient } from '@/lib/supabase/server';

export type NavItem = { label: string; href: string };

/**
 * The 17 discrete `header_settings` keys, matching FMP's Header Settings page
 * (verified against the real FMP source in "PMBC from FMP/", not only against
 * CMS_REFERENCE.md).
 *
 * Brand identity fields (logo_url, brand_name, tagline, colours) are absent on
 * purpose: PMBC keeps those in the `branding_config` table, which the public
 * Navbar, Footer, /api/og and buildPageMetadata already read. See migration 029
 * for the reasoning.
 */
export type HeaderConfig = {
  nav_items: NavItem[];

  // Call to action + mobile (pre-existing).
  cta_label: string;
  cta_href: string;
  show_cta: boolean;
  mobile_menu_enabled: boolean;

  // Logo presentation.
  logo_enabled: boolean;
  logo_width_px: string;
  logo_height_px: string;
  logo_position: 'left' | 'center' | 'right';

  // Branding text toggles.
  show_brand_name: boolean;
  show_tagline: boolean;

  // Header icon.
  icon_url: string;
  icon_as_favicon: boolean;
  icon_in_header: boolean;
  icon_size_px: string;

  // Header layout.
  header_height_px: string;
  header_padding_top_px: string;
  header_padding_bottom_px: string;
  /** PMBC addition (migration 030), not one of FMP's 17 keys. */
  header_layout: HeaderLayout;
};

/** How nav items distribute across the header. See migration 030. */
export type HeaderLayout = 'default' | 'centered' | 'spread';

export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  nav_items: [
    { label: 'Services', href: '/services' },
    { label: 'Sectors', href: '/sectors' },
    { label: 'Approach', href: '/approach' },
    { label: 'Network', href: '/network' },
    // /about was merged into the home page. The slot points at the founder
    // profile under its own label rather than keeping "About" on a personal
    // page, which would be a small bait and switch.
    { label: 'Founder', href: '/about/ahmad-din' },
    { label: 'Contact', href: '/contact' },
  ],
  cta_label: 'Start a Conversation',
  cta_href: '/contact',
  show_cta: true,
  mobile_menu_enabled: true,

  logo_enabled: true,
  logo_width_px: '',
  logo_height_px: '40',
  logo_position: 'left',

  show_brand_name: true,
  show_tagline: false,

  icon_url: '',
  icon_as_favicon: false,
  icon_in_header: false,
  icon_size_px: '20',

  header_height_px: '',
  header_padding_top_px: '',
  header_padding_bottom_px: '',
  header_layout: 'default',
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
 * Reads the navigation menu from the `site_pages` table (migration 027), which
 * is the source of truth edited at /admin/pages. Returns null when the table is
 * empty or unreachable so the caller can fall back to the legacy cms_content
 * JSON array, then to DEFAULT_HEADER_CONFIG. That chain means a missing or
 * partially-applied migration can never render a navbar with no links.
 */
async function fetchSitePagesNav(): Promise<NavItem[] | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select('label, href, visible, display_order')
      .eq('visible', true)
      .order('display_order', { ascending: true });
    if (error) return null;
    const items: NavItem[] = [];
    for (const r of data ?? []) {
      if (r.label && r.href) items.push({ label: r.label, href: r.href });
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/**
 * Reads header settings. Nav items come from `site_pages`; the remaining keys
 * come from discrete cms_content rows under section 'header_settings':
 *   - cta_label, cta_href (text)
 *   - show_cta, mobile_menu_enabled (text 'true'|'false')
 *   - nav_items (JSON array), legacy fallback only, no longer written
 *
 * Falls back to DEFAULT_HEADER_CONFIG for any missing/malformed key.
 */
export async function fetchHeaderConfig(): Promise<HeaderConfig> {
  const supabase = createSupabaseServerClient();
  const [{ data }, sitePagesNav] = await Promise.all([
    supabase.from('cms_content').select('key, value').eq('section', 'header_settings'),
    fetchSitePagesNav(),
  ]);

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

  // Every key falls back to DEFAULT_HEADER_CONFIG, so a database that has not
  // run migration 029 still renders the consolidated form with sane values
  // rather than blank inputs.
  const str = (key: keyof HeaderConfig): string => {
    const v = rows.get(key);
    return typeof v === 'string' ? v : (DEFAULT_HEADER_CONFIG[key] as string);
  };

  return {
    nav_items:
      sitePagesNav ??
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

    logo_enabled: parseBool(rows.get('logo_enabled'), DEFAULT_HEADER_CONFIG.logo_enabled),
    logo_width_px: str('logo_width_px'),
    logo_height_px: str('logo_height_px'),
    logo_position: parsePosition(rows.get('logo_position')),

    show_brand_name: parseBool(
      rows.get('show_brand_name'),
      DEFAULT_HEADER_CONFIG.show_brand_name,
    ),
    show_tagline: parseBool(rows.get('show_tagline'), DEFAULT_HEADER_CONFIG.show_tagline),

    icon_url: str('icon_url'),
    icon_as_favicon: parseBool(
      rows.get('icon_as_favicon'),
      DEFAULT_HEADER_CONFIG.icon_as_favicon,
    ),
    icon_in_header: parseBool(
      rows.get('icon_in_header'),
      DEFAULT_HEADER_CONFIG.icon_in_header,
    ),
    icon_size_px: str('icon_size_px'),

    header_height_px: str('header_height_px'),
    header_padding_top_px: str('header_padding_top_px'),
    header_padding_bottom_px: str('header_padding_bottom_px'),
    header_layout: parseLayout(rows.get('header_layout')),
  };
}

function parsePosition(v: string | null | undefined): 'left' | 'center' | 'right' {
  if (v === 'left' || v === 'center' || v === 'right') return v;
  return DEFAULT_HEADER_CONFIG.logo_position;
}

function parseLayout(v: string | null | undefined): HeaderLayout {
  if (v === 'default' || v === 'centered' || v === 'spread') return v;
  return DEFAULT_HEADER_CONFIG.header_layout;
}
