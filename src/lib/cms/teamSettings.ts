import { fetchSiteSettings } from '@/lib/cms/settings';

/**
 * How many member cards /team puts in a row at desktop width: 2 or 3.
 *
 * One value in Site Settings, changed from the Team & Advisors screen (the
 * same arrangement as the testimonial form switch), so no migration is needed.
 * Absent, unreadable or anything else means 3, the layout /team shipped with.
 * Below desktop width the grid is one column on phones and two on tablets
 * either way.
 */
export const TEAM_CARDS_PER_ROW_KEY = 'team_cards_per_row';

export type TeamCardsPerRow = 2 | 3;

export async function teamCardsPerRow(): Promise<TeamCardsPerRow> {
  try {
    const settings = (await fetchSiteSettings()) as Record<string, unknown>;
    return settings[TEAM_CARDS_PER_ROW_KEY] === 2 ? 2 : 3;
  } catch {
    return 3;
  }
}
