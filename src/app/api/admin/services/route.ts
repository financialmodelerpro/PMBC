import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  title: z.string().min(1).max(200),
  slug: z.string().max(100).optional(),
  number: z.string().max(8).nullish(),
  summary: z.string().nullish(),
  icon: z.string().nullish(),
  hero_image: z.string().nullish(),
  body: z.string().nullish(),
  bullets: z.array(z.string()).optional(),
  cta_text: z.string().nullish(),
  display_order: z.number().int().optional(),
  status: z.enum(['draft', 'published']).optional(),
  seo_title: z.string().nullish(),
  seo_description: z.string().nullish(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'services',
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
