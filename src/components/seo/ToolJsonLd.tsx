/**
 * Structured data for the free tools.
 *
 * A tool page is a `WebApplication` offered at no cost, with the firm as its
 * provider, referenced by the `@id` the Organization node declares in
 * OrganizationJsonLd. The hub is an `ItemList` of the live tools.
 */

import { liveTools, toolPath, type ToolEntry } from '@/config/tools';
import { siteUrl } from '@/lib/seo/metadata';

function Script({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function ToolJsonLd({ tool }: { tool: ToolEntry }) {
  const base = siteUrl();
  const url = `${base}${toolPath(tool.slug)}`;
  return (
    <Script
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: tool.name,
        description: tool.summary,
        url,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        provider: { '@id': `${base}#organization` },
      }}
    />
  );
}

export function ToolsHubJsonLd() {
  const base = siteUrl();
  return (
    <Script
      data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${base}/tools#list`,
        name: 'Free tools',
        itemListElement: liveTools().map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${base}${toolPath(t.slug)}`,
          name: t.name,
        })),
      }}
    />
  );
}
