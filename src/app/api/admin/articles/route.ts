import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  title: z.string().min(1).max(220),
  slug: z.string().max(120).optional(),
  excerpt: z.string().nullish(),
  body: z.string().nullish(),
  cover_url: z.string().nullish(),
  category: z.string().nullish(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  seo_title: z.string().nullish(),
  seo_description: z.string().nullish(),
  featured: z.boolean().optional(),
  published_at: z.string().nullish(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'articles',
  orderBy: { column: 'created_at', ascending: false },
  slugField: 'slug',
  titleField: 'title',
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    title: z.string().min(1).max(220).optional(),
  }),
});
