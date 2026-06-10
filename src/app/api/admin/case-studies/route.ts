import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const metric = z.object({ label: z.string(), value: z.string() });

const base = {
  title: z.string().min(1).max(200),
  slug: z.string().max(100).optional(),
  client_name: z.string().nullish(),
  industry: z.string().nullish(),
  service_id: z.string().uuid().nullish(),
  summary: z.string().nullish(),
  cover_image: z.string().nullish(),
  body: z.string().nullish(),
  metrics: z.array(metric).optional(),
  featured: z.boolean().optional(),
  display_order: z.number().int().optional(),
  status: z.enum(['draft', 'published']).optional(),
  seo_title: z.string().nullish(),
  seo_description: z.string().nullish(),
  published_at: z.string().nullish(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'case_studies',
  orderBy: { column: 'display_order', ascending: true },
  slugField: 'slug',
  titleField: 'title',
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
  }),
});
