import { randomBytes } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * An untyped client for the two things migration 072 adds.
 *
 * `src/types/database.ts` is generated from the applied schema, and 072 is DDL
 * that has to be run by hand, so the generated types do not know the
 * `testimonial_links` table or the six new `testimonials` columns and will not
 * until someone re-runs the generator after applying it. The same escape hatch
 * `collectionApi` uses, for the same reason.
 */
function looseDb(): SupabaseClient {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

/**
 * Private testimonial links: the table, and the two questions asked of it.
 *
 * Kept out of the route files because both the public submit route and the
 * admin screen need the same "is this token usable" answer, and because the
 * whole file has to survive migration 072 not having been run yet.
 */

export type TestimonialLink = {
  id: string;
  token: string;
  label: string;
  note: string | null;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
};

/**
 * 32 bytes, base64url. Long enough that guessing is not a route in, and short
 * enough to paste into an email without wrapping.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * True when the error is Postgres or PostgREST saying the table or column is
 * not there, which is what every caller sees until migration 072 is applied.
 *
 * Matched on the message rather than a code because supabase-js surfaces these
 * from two layers with different shapes: PostgREST's schema cache miss and
 * Postgres's own undefined_table. Both say so in words.
 */
export function isMissingSchema(message: string | undefined | null): boolean {
  const m = (message ?? '').toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    m.includes('undefined_table') ||
    m.includes('relation') && m.includes('does not exist')
  );
}

export type LinkLookup =
  | { state: 'ok'; link: TestimonialLink }
  | { state: 'unknown' }
  | { state: 'revoked' }
  | { state: 'unavailable' };

/**
 * Resolve a token from a URL.
 *
 * Three failures are told apart on purpose. `unknown` is a token that never
 * existed or was mistyped. `revoked` is one that did exist and was turned off,
 * which deserves a different sentence to the client holding it. `unavailable`
 * is the schema not being there yet, which is an operator problem and must not
 * be reported to a visitor as though their link were bad.
 */
export async function lookupLink(token: string): Promise<LinkLookup> {
  const value = token.trim();
  if (!value) return { state: 'unknown' };

  const supabase = looseDb();
  const { data, error } = await supabase
    .from('testimonial_links')
    .select('id, token, label, note, active, created_at, last_used_at, use_count')
    .eq('token', value)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error.message)) return { state: 'unavailable' };
    return { state: 'unavailable' };
  }
  if (!data) return { state: 'unknown' };
  const link = data as unknown as TestimonialLink;
  if (!link.active) return { state: 'revoked' };
  return { state: 'ok', link };
}

/**
 * Record that a link was used. Best effort: a submission must not fail because
 * its counter did not increment.
 */
export async function markLinkUsed(link: TestimonialLink): Promise<void> {
  try {
    const supabase = looseDb();
    await supabase
      .from('testimonial_links')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: (link.use_count ?? 0) + 1,
      })
      .eq('id', link.id);
  } catch {
    // Deliberately swallowed. See above.
  }
}
