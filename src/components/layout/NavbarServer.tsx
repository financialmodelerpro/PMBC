import { fetchBranding } from '@/lib/cms/branding';
import { fetchHeaderConfig, DEFAULT_HEADER_CONFIG } from '@/lib/cms/headerSettings';
import { fetchPublishedServices } from '@/lib/cms/collections';
import { SERVICES } from '@/config/services';
import { Navbar, type NavbarDropdowns } from './Navbar';

/**
 * Parses a cms_content pixel string. Blank, non-numeric, or zero means "unset",
 * so the Navbar falls back to its own shipped default rather than collapsing to
 * a zero-height header.
 */
function px(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Children for the Services nav item.
 *
 * Reads the managed `services` table and falls back to the static config,
 * exactly as `/services` itself does, so the menu and the page it belongs to
 * can never list different services. An empty list means the Navbar renders
 * Services as a plain link, which is what it did before this existed.
 */
async function servicesDropdown(): Promise<NavbarDropdowns> {
  let rows: { slug: string; title: string; number: string }[] = [];
  try {
    const managed = await fetchPublishedServices();
    rows = managed.map((s) => ({
      slug: s.slug,
      title: s.title,
      number: s.number ?? '',
    }));
  } catch {
    rows = [];
  }
  if (rows.length === 0) {
    rows = SERVICES.map((s) => ({ slug: s.slug, title: s.title, number: s.number }));
  }
  return {
    '/services': rows.map((s) => ({
      label: s.title,
      href: `/services/${s.slug}`,
      meta: s.number,
    })),
  };
}

export async function NavbarServer() {
  const [brandingRow, header, dropdowns] = await Promise.all([
    safeFetchBranding(),
    safeFetchHeader(),
    servicesDropdown(),
  ]);

  return (
    <Navbar
      dropdowns={dropdowns}
      brand={{
        name: brandingRow?.brand_name ?? 'PaceMakers Business Consultants',
        shortName: brandingRow?.short_name ?? 'PaceMakers',
        tagline: brandingRow?.tagline ?? null,
        logoUrl: brandingRow?.logo_url ?? null,
        logoDarkUrl: brandingRow?.logo_dark_url ?? null,
      }}
      navItems={header.nav_items}
      cta={
        header.show_cta && header.cta_label && header.cta_href
          ? { label: header.cta_label, href: header.cta_href }
          : null
      }
      mobileMenuEnabled={header.mobile_menu_enabled}
      /*
       * Presentation settings from cms_content section='header_settings'
       * (migrations 029 + 030), edited at /admin/header-settings. Every numeric
       * value is nullable so the Navbar keeps its shipped default when a key is
       * blank, missing, or the migration has not been applied yet.
       */
      presentation={{
        headerBackground: header.header_background,
        headerHeightPx: px(header.header_height_px),
        headerPaddingTopPx: px(header.header_padding_top_px),
        headerPaddingBottomPx: px(header.header_padding_bottom_px),
        headerLayout: header.header_layout,
        logoEnabled: header.logo_enabled,
        logoHeightPx: px(header.logo_height_px),
        logoWidthPx: px(header.logo_width_px),
        logoPosition: header.logo_position,
        showBrandName: header.show_brand_name,
        showTagline: header.show_tagline,
        // icon_in_header gates the icon, matching the admin toggle: an icon URL
        // with the toggle off must not render.
        iconUrl: header.icon_in_header && header.icon_url ? header.icon_url : null,
        iconSizePx: px(header.icon_size_px),
      }}
    />
  );
}

async function safeFetchBranding() {
  try {
    return await fetchBranding();
  } catch {
    return null;
  }
}

async function safeFetchHeader() {
  try {
    return await fetchHeaderConfig();
  } catch {
    return DEFAULT_HEADER_CONFIG;
  }
}
