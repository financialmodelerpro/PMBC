import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  name: z.string().min(1).max(160),
  role: z.string().nullish(),
  company: z.string().nullish(),
  text: z.string().min(1),
  rating: z.number().int().min(1).max(5).nullish(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  testimonial_type: z.enum(['written', 'video']).optional(),
  video_url: z.string().nullish(),
  is_featured: z.boolean().optional(),
  show_on_landing: z.boolean().optional(),
  display_order: z.number().int().optional(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'testimonials',
  orderBy: { column: 'display_order', ascending: true },
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
    text: z.string().min(1).optional(),
  }),
});
