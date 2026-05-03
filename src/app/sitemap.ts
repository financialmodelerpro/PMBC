import type { MetadataRoute } from 'next';

import { SERVICES } from '@/config/services';

function baseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://pacemakersglobal.com';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();

  const firmRoutes = [
    '',
    '/services',
    '/sectors',
    '/approach',
    '/network',
    '/about',
    '/financial-modeler-pro',
    '/contact',
    '/privacy',
    '/terms',
  ];

  const serviceRoutes = SERVICES.map((s) => `/services/${s.slug}`);

  return [...firmRoutes, ...serviceRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : path.startsWith('/services/') ? 0.7 : 0.8,
  }));
}
