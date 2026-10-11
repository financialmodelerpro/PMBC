import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

/**
 * The write surface for team members, held to the same fields the editor at
 * /admin/team offers.
 *
 * `linkedin_url` and `email` are columns on `team_members` (migration 023) that
 * nothing renders and nothing edits. They are not accepted here so that the API
 * and the editor describe the same record. zod strips unknown keys rather than
 * rejecting them, so a stale client posting either one is ignored rather than
 * failing, and the columns keep whatever they already hold.
 */
/** One short line per item, at most twelve; blank items are dropped rather than refused. */
const itemList = z
  .array(z.string().max(300))
  .max(12)
  .transform((list) => list.map((s) => s.trim()).filter(Boolean))
  .optional();

const base = {
  name: z.string().min(1).max(160),
  role: z.string().nullish(),
  /** Rendered as "Qualifications". The credentials line under the role. */
  credentials: z.string().nullish(),
  /** Rendered as "Experience". Sanitised rich text, so it is not length-capped. */
  bio: z.string().nullish(),
  photo: z.string().nullish(),
  display_order: z.number().int().optional(),
  /** Rendered as "Published". Also gates /team in the navbar, footer and sitemap. */
  visible: z.boolean().optional(),
  /** Migration 101. "full" links to a profile page; "compact" shows the two lists on the card. */
  profile_type: z.enum(['full', 'compact']).optional(),
  /** "Selected experience" and "Expertise" (101). Blank lines are dropped. */
  experience_items: itemList,
  expertise_items: itemList,
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
