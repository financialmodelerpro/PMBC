import type { MetadataRoute } from 'next';

function baseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://pacemakersglobal.com';
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
