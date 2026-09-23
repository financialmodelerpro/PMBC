/**
 * The Growth Engine's AI agents (from Phase 2, 2026-09-23). Pure.
 *
 * One list, read by Growth Settings (the per-agent model choice) and by each
 * agent when it calls `runAi`. Every agent defaults to DEFAULT_MODEL (Claude
 * Sonnet 5); Ahmad can move any agent to another priced model in Settings.
 * None defaults to Opus: nothing here needs it enough to pay the difference.
 */

import { DEFAULT_MODEL } from './pricing';

export const GROWTH_AGENTS = [
  { key: 'research-agent', label: 'Research Agent', purpose: 'Company research briefs with a source for every fact' },
  { key: 'signal-feed', label: 'Daily signal feed', purpose: 'The morning search for new trigger events' },
  { key: 'outreach-writer', label: 'Outreach writer', purpose: 'Email and LinkedIn drafts and follow-ups' },
  { key: 'website-chat', label: 'Website chat', purpose: 'Answers visitors and qualifies them from the approved Knowledge Base' },
  { key: 'meeting-brief', label: 'Meeting brief', purpose: 'The brief before each call' },
  { key: 'meeting-recap', label: 'Meeting recap', purpose: 'Recap and no-show rebooking drafts' },
] as const;

export type GrowthAgentKey = (typeof GROWTH_AGENTS)[number]['key'];

/** The model an agent runs on: its override in Settings, or the default. */
export function modelForAgent(agent: string, overrides: Record<string, string> | null | undefined): string {
  const m = overrides?.[agent];
  return typeof m === 'string' && m.trim() ? m : DEFAULT_MODEL;
}
