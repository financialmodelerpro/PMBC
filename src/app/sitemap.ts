import type { MetadataRoute } from 'next';

import { SERVICES } from '@/config/services';
import {
  fetchPublishedCaseStudies,
  fetchPublishedArticles,
} from '@/lib/cms/collections';

function baseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://pacemakersglobal.com';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  const firmRoutes = [
    '',
    '/services',
    '/sectors',
    // `/approach` is deliberately absent since its nav item was hidden. The
    // route still renders and nothing about the page changed, but it is no
    // longer part of the site's own structure, so it is not offered to
    // crawlers either. Re-adding this line and the nav item brings it back.
    '/network',
    // `/about` is gone: it was merged into the home page and now 301s there.
    // The founder profile keeps its nested path.
    '/about/ahmad-din',
    '/team',
    '/case-studies',
    '/insights',
    '/fmp',
    // The three FMP-fed sub-pages under /financial-modeler-pro are deliberately
    // absent. They still render and the API integration behind them still runs,
    // but nothing links to them and they are not offered to crawlers, so /fmp
    // is the single canonical platform page. Re-adding a line here is all it
    // takes to bring one back.
    '/contact',
    '/book',
    '/privacy',
    '/terms',
  ];

  const serviceRoutes = SERVICES.map((s) => `/services/${s.slug}`);

  const [studies, articles] = await Promise.all([
    fetchPublishedCaseStudies(),
    fetchPublishedArticles(),
  ]);
  const caseStudyRoutes = studies.map((s) => `/case-studies/${s.slug}`);
  const insightRoutes = articles.map((a) => `/insights/${a.slug}`);

  return [
    ...firmRoutes,
    ...serviceRoutes,
    ...caseStudyRoutes,
    ...insightRoutes,
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : path.startsWith('/services/') ? 0.7 : 0.8,
  }));
}
