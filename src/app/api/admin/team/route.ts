import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  name: z.string().min(1).max(160),
  role: z.string().nullish(),
  photo: z.string().nullish(),
  bio: z.string().nullish(),
  credentials: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  email: z.string().nullish(),
  display_order: z.number().int().optional(),
  visible: z.boolean().optional(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'team_members',
  orderBy: { column: 'display_order', ascending: true },
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
  }),
});
