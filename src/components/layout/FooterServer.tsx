import { fetchBranding } from '@/lib/cms/branding';
import { fetchContentBySection } from '@/lib/cms/content';
import { fetchSiteSettings, type SiteSettings } from '@/lib/cms/settings';
import { Footer } from './Footer';

export async function FooterServer() {
  const [branding, footerContent, settings] = await Promise.all([
    safe(fetchBranding(), null),
    safe(fetchContentBySection('footer_settings'), {} as Record<string, string>),
    safe(fetchSiteSettings(), {} as SiteSettings),
  ]);

  return (
    <Footer
      brand={{
        name: branding?.brand_name ?? 'PaceMakers Business Consultants',
        shortName: branding?.short_name ?? 'PaceMakers',
        tagline: branding?.tagline ?? 'Advisory from Structure to Exit',
        logoUrl: branding?.logo_url ?? null,
        logoDarkUrl: branding?.logo_dark_url ?? null,
      }}
      footerContent={footerContent}
      settings={settings}
    />
  );
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
