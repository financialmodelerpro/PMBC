/**
 * Structured data for the free tools. Rendered only for Live tools: a Hidden
 * tool's page is a 404 to the public and an Admin preview to staff, and neither
 * should describe an application to a crawler.
 *
 * A tool page is a `WebApplication` offered at no cost, with the firm as its
 * provider, referenced by the `@id` the Organization node declares in
 * OrganizationJsonLd. The hub is an `ItemList` of the Live tools.
 */

import { toolPath, type ToolEntry } from '@/config/tools';
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

export function ToolsHubJsonLd({ tools }: { tools: ToolEntry[] }) {
  const base = siteUrl();
  return (
    <Script
      data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${base}/tools#list`,
        name: 'Free tools',
        itemListElement: tools.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${base}${toolPath(t.slug)}`,
          name: t.name,
        })),
      }}
    />
  );
}
