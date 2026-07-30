import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(300),
  display_order: z.number().int().optional(),
  visible: z.boolean().optional(),
};

export const { GET, POST, PATCH, DELETE } = createCollectionApi({
  table: 'site_pages',
  orderBy: { column: 'display_order', ascending: true },
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    label: z.string().min(1).max(80).optional(),
    href: z.string().min(1).max(300).optional(),
  }),
});
