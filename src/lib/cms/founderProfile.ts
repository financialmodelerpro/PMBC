/**
 * The founder's identity, read from the founder profile page itself.
 *
 * WHY THIS EXISTS
 * /team lists the founding partner first and links his card through to the full
 * profile at /about/ahmad-din rather than repeating the bio that already lives
 * there. Something has to decide which of the team rows is that person.
 *
 * The three ways of deciding, and why this one:
 *   - A hardcoded 'Ahmad Din' in the renderer. Fastest, and wrong the first time
 *     the name is edited in one place and not the other.
 *   - A column on `team_members` holding a profile path. Honest, but adding a
 *     column is DDL, supabase-js cannot run DDL, and it would put a tenth field
 *     in an admin editor that is meant to carry exactly seven.
 *   - Ask the profile page who it is about. That is this file. The founder_hero
 *     section already stores the name as content, the page builder already edits
 *     it, and a rename there moves the match with it.
 *
 * The cost is one extra query on /team only. The navbar and footer do not call
 * this; they gate on the row count instead.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { publicPathForPageSlug } from '@/lib/cms/pageRoutes';

/** The page slug the founder profile lives under. */
export const FOUNDER_PAGE_SLUG = 'about-ahmad-din';

export type FounderProfile = {
  /** The name as stored on the profile's own hero. */
  name: string;
  /** The public path to that profile, resolved through the shared route map. */
  path: string;
};

/**
 * Reads the founder_hero section of the founder profile page.
 *
 * Returns null when the page, the section or the name is missing, in which case
 * /team renders every member as an ordinary card. That is a graceful outcome
 * rather than a broken one: the cards still carry name, role, qualifications and
 * experience, and only the link through to the longer profile is absent.
 */
export async function fetchFounderProfile(): Promise<FounderProfile | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('page_sections')
      .select('content')
      .eq('page_slug', FOUNDER_PAGE_SLUG)
      .eq('section_type', 'founder_hero')
      .eq('visible', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const content = data.content as Record<string, unknown> | null;
    const name = typeof content?.name === 'string' ? content.name.trim() : '';
    if (!name) return null;

    return { name, path: publicPathForPageSlug(FOUNDER_PAGE_SLUG) };
  } catch {
    return null;
  }
}

/**
 * Whether a team member is the person the founder profile is about.
 *
 * Compared case-insensitively on trimmed whitespace, because the two values are
 * typed into two different admin screens by the same person and "Ahmad Din" and
 * "ahmad din " should not be two people.
 */
export function isFounder(memberName: string, founder: FounderProfile | null): boolean {
  if (!founder) return false;
  return memberName.trim().toLowerCase() === founder.name.trim().toLowerCase();
}
