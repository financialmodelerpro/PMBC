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
  // The testimonials table (migration 025) has no updated_at column; its time
  // columns are created_at and approved_at. The factory stamps updated_at by
  // default, which made every create and update fail with
  // "Could not find the 'updated_at' column". Found while verifying Phase 7.
  touchUpdatedAt: false,
  /**
   * approved_at is owned by the server, not the client. It is deliberately
   * absent from the zod schemas above, so an admin cannot post an arbitrary
   * approval date; it is derived here from the status transition alone.
   *
   * Only a genuine change of status moves it. Re-saving an already-approved
   * testimonial (editing its wording, flipping Featured) leaves the original
   * approval time intact, which is the whole point of recording it.
   */
  transformWrite: (row, { before }) => {
    const next = row.status;
    if (typeof next !== 'string') return row;
    if (before && before.status === next) return row;
    row.approved_at = next === 'approved' ? new Date().toISOString() : null;
    return row;
  },
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
    text: z.string().min(1).optional(),
  }),
});
