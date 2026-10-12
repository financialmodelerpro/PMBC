/**
 * Team profiles: one record per person, read by every place that shows them.
 *
 * WHY THIS EXISTS
 * A member used to be typed in twice: a `team_members` row for the /team card,
 * and the `founder_hero` section of their profile page for the page header. The
 * two drifted (a location in the qualifications slot, a credentials line with a
 * missing space). Since migration 109 the member row is the one source:
 *
 *   team_members                 name, role, photo, qualification, years,
 *                                location, order, published, profile_slug
 *   their profile page sections  everything else: intro, contacts, lists,
 *                                paragraphs, quote
 *
 * The profile header takes name, photo and the credentials line from the member
 * (`applyMemberToHero`), and the title from the member's role unless the page
 * sets its own headline. The card's key highlights are the first items of the
 * profile list marked "Show on team card" (`show_on_card`), so a highlight is
 * written once, on the profile, and the card follows.
 *
 * Every read degrades: before 109 the `profile_slug` column is absent, a member
 * has no slug, and callers fall back to what they did before (see the /team
 * page and `founderProfile.ts`).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

type MemberRow = Tables<'team_members'>;

/** Profile page slugs are `about-<name>` and render at `/team/<name>`. */
export const PROFILE_SLUG_PREFIX = 'about-';

/** How many key highlights a /team card shows. */
export const CARD_HIGHLIGHTS = 3;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The member's profile page slug, or null when none is linked (or 109 is not applied). */
export function memberProfileSlug(member: unknown): string | null {
  const slug = text((member as { profile_slug?: unknown } | null)?.profile_slug);
  return slug.startsWith(PROFILE_SLUG_PREFIX) ? slug : null;
}

/**
 * The one credentials line: "ACCA | FMVA | 12+ Years Experience | Riyadh, KSA".
 * Qualification, then years (with "Experience" added unless already written),
 * then location, each only when filled. Separators are spaced evenly whatever
 * was typed.
 */
export function memberCredentialsLine(member: unknown): string {
  const m = (member ?? {}) as Record<string, unknown>;
  const years = text(m.experience_years);
  return [
    text(m.credentials),
    years && !/experience/i.test(years) ? `${years} Experience` : years,
    text(m.location),
  ]
    .filter(Boolean)
    .join(' | ')
    .replace(/\s*\|\s*/g, ' | ');
}

/**
 * The profile header's content with the member's fields laid over it. The
 * member always wins on name, photo and credentials line; the title's first
 * line keeps the page's own headline when one is set (the founding partner's
 * is a specialism, not his role) and otherwise shows the role.
 */
export function applyMemberToHero(
  content: Record<string, unknown>,
  member: MemberRow | null,
): Record<string, unknown> {
  if (!member) return content;
  return {
    ...content,
    name: member.name,
    photo_url: member.photo ?? '',
    credentials_line: memberCredentialsLine(member),
    title_primary: text(content.title_primary) || text(member.role),
  };
}

/** Lays the member over every `founder_hero` in a section list. */
export function withMemberHero<T extends { section_type: string; content: unknown }>(
  sections: T[],
  member: MemberRow | null,
): T[] {
  if (!member) return sections;
  return sections.map((s) =>
    s.section_type === 'founder_hero'
      ? { ...s, content: applyMemberToHero((s.content ?? {}) as Record<string, unknown>, member) }
      : s,
  );
}

/** The member whose profile page this is, or null (none linked, 109 absent, or a failed read). */
export async function fetchMemberForProfile(profileSlug: string): Promise<MemberRow | null> {
  try {
    const { data, error } = await createSupabaseServerClient()
      .from('team_members')
      .select('*')
      .eq('profile_slug', profileSlug)
      .maybeSingle();
    if (error || !data) return null;
    return data as MemberRow;
  } catch {
    return null;
  }
}

/**
 * The card highlights of each profile page: the items of its first visible
 * list section marked "Show on team card", trimmed, at most CARD_HIGHLIGHTS.
 * A page with no marked list is absent from the map. Empty on a failed read.
 */
export async function fetchCardHighlights(profileSlugs: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (profileSlugs.length === 0) return out;
  try {
    const { data, error } = await createSupabaseServerClient()
      .from('page_sections')
      .select('page_slug, content, display_order')
      .in('page_slug', profileSlugs)
      .eq('section_type', 'founder_credentials')
      .eq('visible', true)
      .order('display_order', { ascending: true });
    if (error || !data) return out;
    for (const row of data) {
      if (out.has(row.page_slug)) continue;
      const content = (row.content ?? {}) as Record<string, unknown>;
      if (content.show_on_card !== true) continue;
      const items = Array.isArray(content.items)
        ? content.items.map(text).filter(Boolean).slice(0, CARD_HIGHLIGHTS)
        : [];
      out.set(row.page_slug, items);
    }
    return out;
  } catch {
    return out;
  }
}
