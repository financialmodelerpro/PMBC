/**
 * Integration status for the Growth Engine (Unit 1.4, 2026-09-22). Server only.
 *
 * Each integration is Configured only when its code is built AND every
 * environment variable it needs is present. Values are never read out, only
 * whether a name is set. Integrations whose code does not exist yet show Not
 * set up whatever the environment holds; the unit that builds one sets
 * `built: true`, and the variable names listed here are the names that unit
 * will read.
 */

export type IntegrationKey = 'claude' | 'microsoft_graph' | 'brevo';

type IntegrationDef = { key: IntegrationKey; label: string; purpose: string; built: boolean; env: string[]; arrivesIn?: string };

export const INTEGRATIONS: readonly IntegrationDef[] = [
  { key: 'claude', label: 'Claude API', purpose: 'Research, drafting and scoring by AI agents', built: false, env: ['ANTHROPIC_API_KEY'], arrivesIn: 'Unit 1.5' },
  {
    key: 'microsoft_graph',
    label: 'Microsoft Graph (email and Bookings)',
    purpose: 'Sending outreach from the firm mailbox and reading Bookings',
    built: false,
    env: ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET'],
    arrivesIn: 'Phase 3 (Outreach)',
  },
  { key: 'brevo', label: 'Brevo', purpose: 'Transactional email from the site and the free tools', built: true, env: ['BREVO_API_KEY', 'EMAIL_FROM_DEFAULT'] },
];

export type IntegrationStatus = { key: IntegrationKey; label: string; purpose: string; state: 'configured' | 'not_set_up'; detail: string };

/** `env` is injectable so the verifier can prove the rules without touching real values. */
export function integrationStatus(env: Record<string, string | undefined> = process.env): IntegrationStatus[] {
  return INTEGRATIONS.map((i) => {
    const missing = i.env.filter((name) => !env[name]?.trim());
    if (!i.built) return { key: i.key, label: i.label, purpose: i.purpose, state: 'not_set_up', detail: `Not built yet${i.arrivesIn ? `, arrives in ${i.arrivesIn}` : ''}.` };
    if (missing.length) return { key: i.key, label: i.label, purpose: i.purpose, state: 'not_set_up', detail: `Missing: ${missing.join(', ')}.` };
    return { key: i.key, label: i.label, purpose: i.purpose, state: 'configured', detail: `Set: ${i.env.join(', ')}.` };
  });
}
