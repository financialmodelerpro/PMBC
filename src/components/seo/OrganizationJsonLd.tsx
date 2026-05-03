/**
 * Server component that emits a JSON-LD <script> with the firm's
 * `Organization` + `FinancialService` schema. Mounts in the public layout so
 * it appears on every customer-facing page.
 *
 * Pulls structured data from `branding_config` (logo + brand name) and
 * `site_settings` (contact email, social links, office). Falls back to
 * sensible defaults if the DB is unreachable.
 */

import { fetchBranding } from '@/lib/cms/branding';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { siteUrl } from '@/lib/seo/metadata';

const FOUNDING_DATE = '2017';

async function safeBranding() {
  try {
    return await fetchBranding();
  } catch {
    return null;
  }
}

async function safeSettings() {
  try {
    return await fetchSiteSettings();
  } catch {
    return {};
  }
}

export async function OrganizationJsonLd() {
  const [branding, settings] = await Promise.all([safeBranding(), safeSettings()]);

  const base = siteUrl();
  const name = branding?.brand_name ?? 'PaceMakers Business Consultants';
  const description =
    'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.';
  const logo = branding?.logo_url ? toAbsolute(branding.logo_url, base) : `${base}/icon.svg`;

  const sameAs: string[] = [];
  if (settings.social_linkedin) sameAs.push(settings.social_linkedin);
  if (settings.social_twitter) sameAs.push(settings.social_twitter);

  const contactPoint = settings.contact_email
    ? {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: settings.contact_email,
        ...(settings.phone_number ? { telephone: settings.phone_number } : {}),
        availableLanguage: ['English', 'Arabic'],
      }
    : null;

  // Schema.org allows a top-level node graph so multiple types share one
  // <script> tag — cleaner than emitting two scripts.
  const graph: unknown[] = [
    {
      '@type': 'FinancialService',
      '@id': `${base}#financialservice`,
      name,
      url: base,
      logo,
      description,
      foundingDate: FOUNDING_DATE,
      areaServed: ['Saudi Arabia', 'GCC', 'Worldwide'],
      ...(contactPoint ? { contactPoint } : {}),
      ...(settings.office_location_text
        ? {
            address: {
              '@type': 'PostalAddress',
              addressLocality: settings.office_location_text,
            },
          }
        : {}),
    },
    {
      '@type': 'Organization',
      '@id': `${base}#organization`,
      name,
      url: base,
      logo,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${base}#website`,
      url: base,
      name,
      publisher: { '@id': `${base}#organization` },
    },
  ];

  const ld = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify is safe here — keys are static and values are sanitised
      // via JSON encoding, which escapes embedded < and >.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}

function toAbsolute(url: string, base: string): string {
  if (/^https?:/i.test(url)) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
