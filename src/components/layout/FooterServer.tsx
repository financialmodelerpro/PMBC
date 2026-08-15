import { fetchBranding } from '@/lib/cms/branding';
import { fetchContentBySection } from '@/lib/cms/content';
import { fetchSiteSettings, type SiteSettings } from '@/lib/cms/settings';
import { parseFooterConfig } from '@/lib/cms/footerSettings';
import { parseFooterLinks } from '@/lib/cms/footerLinks';
import { fetchSuppressedNavHrefs, isSuppressed } from '@/lib/public/collectionGates';
import { Footer } from './Footer';

export async function FooterServer() {
  const [branding, footerContent, settings, suppressed] = await Promise.all([
    safe(fetchBranding(), null),
    safe(fetchContentBySection('footer_settings'), {} as Record<string, string>),
    safe(fetchSiteSettings(), {} as SiteSettings),
    safe(fetchSuppressedNavHrefs(), new Set<string>()),
  ]);

  /*
   * Same gate as the navbar. The Team link ships visible in Footer Links, and
   * this is what keeps it out of the footer until there is a profile to open.
   * The Firm column already hides itself when it has no visible links, so an
   * empty result here degrades correctly rather than leaving a bare heading.
   */
  const links = parseFooterLinks(footerContent.links).filter(
    (link) => !isSuppressed(link.href, suppressed),
  );

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
      // Parsed from the same row map the copy keys come from, so the sizing
      // controls cost no extra query.
      footerConfig={parseFooterConfig(footerContent)}
      links={links}
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
