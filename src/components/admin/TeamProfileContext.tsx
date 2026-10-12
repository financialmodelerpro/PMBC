'use client';

import { createContext, useContext } from 'react';

/**
 * Set when the section editors are rendered inside a member's screen in Team &
 * Advisors rather than in the general page builder.
 *
 * The profile header's name, photo and credentials line come from the member
 * record there, so the hero editor shows a note in their place instead of
 * fields that would write to nothing; and a list section offers "Show on team
 * card", which is meaningless on any other page.
 */
export const TeamProfileContext = createContext<{ memberName: string } | null>(null);

export function useTeamProfile() {
  return useContext(TeamProfileContext);
}
