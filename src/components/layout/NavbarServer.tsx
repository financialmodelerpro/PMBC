import { fetchBranding } from '@/lib/cms/branding';
import { fetchHeaderConfig, DEFAULT_HEADER_CONFIG } from '@/lib/cms/headerSettings';
import { Navbar } from './Navbar';

export async function NavbarServer() {
  const [brandingRow, header] = await Promise.all([
    safeFetchBranding(),
    safeFetchHeader(),
  ]);

  return (
    <Navbar
      brand={{
        name: brandingRow?.brand_name ?? 'PaceMakers Business Consultants',
        shortName: brandingRow?.short_name ?? 'PaceMakers',
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
