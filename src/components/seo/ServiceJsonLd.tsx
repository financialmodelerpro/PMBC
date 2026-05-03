/**
 * Per-service `Service` JSON-LD with a `provider` reference back to the
 * firm's Organization node (declared in OrganizationJsonLd). Mounts on
 * /services/[slug] pages.
 */

import { siteUrl } from '@/lib/seo/metadata';

export function ServiceJsonLd({
  slug,
  name,
  description,
  url,
}: {
  slug: string;
  name: string;
  description: string;
  url: string;
}) {
  const base = siteUrl();
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name,
    description,
    serviceType: name,
    url,
    provider: { '@id': `${base}#organization` },
    areaServed: ['Saudi Arabia', 'GCC', 'Worldwide'],
    additionalType: `${base}/services/${slug}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
