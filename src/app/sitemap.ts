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
    '/approach',
    '/network',
    '/about',
    '/team',
    '/case-studies',
    '/insights',
    '/financial-modeler-pro',
    '/contact',
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
