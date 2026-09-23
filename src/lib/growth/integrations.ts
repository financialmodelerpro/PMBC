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

export type IntegrationKey = 'claude' | 'microsoft_graph' | 'microsoft_bookings' | 'brevo' | 'brevo_nurture';

type IntegrationDef = { key: IntegrationKey; label: string; purpose: string; built: boolean; env: string[]; arrivesIn?: string; mockWithout?: boolean };

export const INTEGRATIONS: readonly IntegrationDef[] = [
  // Built in Unit 1.5: without the key the AI layer runs in mock mode, so it shows Mock mode rather than Not set up.
  { key: 'claude', label: 'Claude API', purpose: 'Research, drafting and scoring by AI agents', built: true, env: ['ANTHROPIC_API_KEY'], mockWithout: true },
  // Built in Unit 3.2: without all four variables outreach runs in mock mode (nothing delivered, labelled).
  {
    key: 'microsoft_graph',
    label: 'Microsoft Graph (email)',
    purpose: 'Sending outreach from the firm mailbox and detecting replies',
    built: true,
    env: ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER'],
    mockWithout: true,
  },
  // Built in Unit 5.1: without these, the Bookings sync is a labelled preview and calls are added by hand.
  {
    key: 'microsoft_bookings',
    label: 'Microsoft Bookings',
    purpose: 'Reading booked calls, moves and cancellations',
    built: true,
    env: ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER', 'MS_BOOKINGS_BUSINESS_ID'],
    mockWithout: true,
  },
  { key: 'brevo', label: 'Brevo', purpose: 'Transactional email from the site and the free tools', built: true, env: ['BREVO_API_KEY', 'EMAIL_FROM_DEFAULT'] },
];

export type IntegrationStatus = { key: IntegrationKey; label: string; purpose: string; state: 'configured' | 'mock' | 'not_set_up'; detail: string };

/** `env` is injectable so the verifier can prove the rules without touching real values. */
export function integrationStatus(env: Record<string, string | undefined> = process.env): IntegrationStatus[] {
  return INTEGRATIONS.map((i) => {
    const missing = i.env.filter((name) => !env[name]?.trim());
    if (!i.built) return { key: i.key, label: i.label, purpose: i.purpose, state: 'not_set_up', detail: `Not built yet${i.arrivesIn ? `, arrives in ${i.arrivesIn}` : ''}.` };
    if (missing.length && i.mockWithout) return { key: i.key, label: i.label, purpose: i.purpose, state: 'mock', detail: i.key === 'claude' ? `Mock mode: ${missing.join(', ')} is not set, so AI features answer with labelled sample output at no cost. Set it and the real API is used with no code change.` : `Mock mode: ${missing.join(', ')} not set, so nothing is delivered and every send is recorded as mock. Set them and the real service is used with no code change.` };
    if (missing.length) return { key: i.key, label: i.label, purpose: i.purpose, state: 'not_set_up', detail: `Missing: ${missing.join(', ')}.` };
    return { key: i.key, label: i.label, purpose: i.purpose, state: 'configured', detail: `Set: ${i.env.join(', ')}.` };
  });
}
