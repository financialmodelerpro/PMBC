/**
 * The Lead Score (Unit 3.5, 2026-09-23). Pure.
 *
 * Set once a lead has engaged (a reply, a click, a chat, a meeting or a
 * meeting request); before that the lead has only its Prospect Score. Seven
 * factors, weights from Growth Settings (default ICP fit 25, clear need 20,
 * scale 15, timeline 15, authority 10, engagement 10, meeting intent 5).
 *
 * Scored on what is known (recalibrated 2026-10-06). A factor with no answer
 * (no contact, no timeline, no engagement yet, no meeting asked for) is left
 * out rather than scored zero, and the total is scaled to the weight of the
 * factors that are known. ICP fit counts only its known parts (geography 10,
 * sector 15 of its 25), and the sector is read from the service when the lead
 * has none (REFM is real estate). The unknown factors are listed in the
 * reasons so the score can be read.
 *
 * Temperature: Hot 71 and over, Warm 41 to 70, Cold 40 and under. Rules
 * applied whatever the total, in this order:
 * 1. Hot from the total needs both the size and the timeline known, so a lead
 *    with one or two strong answers cannot read Hot on those alone.
 * 2. A priority sector (the tiers marked priority in Settings, real estate
 *    only by default), SAR 50 million or more and a timeline within three months is at least
 *    Warm, and Hot with intent: a call, a quote or a proposal asked for.
 * 3. A meeting request is always Hot.
 * 4. A known size under SAR 50 million caps the lead at Cold: that rule wins
 *    even over a meeting request, because the minimum is the firm's floor for
 *    taking work on.
 */

import { DEFAULT_LEAD_WEIGHTS, LEAD_FACTORS, resolveSectorTiers, type LeadFactor, type LeadWeights, type SectorTiers } from '../engineSettingsModel';
import { MINIMUM_DEAL_SIZE_SAR, type LeadTemperature } from '../model';
import { withIndefiniteArticle } from '../../public/grammar';
import { geographyShare, scaleShare, sectorShare, titleMatches } from './prospect';

export const TEMPERATURE_THRESHOLDS = { hot: 71, warm: 41 } as const;

export function temperatureFor(score: number): LeadTemperature {
  if (score >= TEMPERATURE_THRESHOLDS.hot) return 'hot';
  if (score >= TEMPERATURE_THRESHOLDS.warm) return 'warm';
  return 'cold';
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20, 'a couple of': 2, 'a few': 3, few: 3, couple: 2 };

/** Months until a decision, read from free text ("3 months", "within three months", "a few weeks"); null when it says nothing usable. */
export function timelineMonths(text: string | null | undefined): number | null {
  const t = (text ?? '')
    .toLowerCase()
    .replace(/\b(a couple of|a few|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty|few|couple)\s+(weeks?|months?)\b/g, (_m, n: string, unit: string) => `${NUMBER_WORDS[n]} ${unit}`);
  if (!t.trim()) return null;
  if (/\b(immediate|immediately|asap|urgent|now|this month|right away)\b/.test(t)) return 0.5;
  const weeks = t.match(/(\d+)\s*weeks?/);
  if (weeks) return Number(weeks[1]) / 4.3;
  const months = t.match(/(\d+)\s*(?:to\s*\d+\s*)?months?/);
  if (months) return Number(months[1]);
  if (/\bnext month\b/.test(t)) return 1;
  if (/\b(this|next) quarter\b|\bq[1-4]\b/.test(t)) return 3;
  if (/\bhalf[- ]year|six months\b/.test(t)) return 6;
  if (/\b(this|next) year|12 months|a year\b/.test(t)) return 12;
  if (/\b(no rush|exploring|someday|not sure|undecided)\b/.test(t)) return 24;
  return null;
}

export function timelineShare(months: number | null): number {
  if (months === null) return 0;
  if (months <= 3) return 1;
  if (months <= 6) return 0.6;
  if (months <= 12) return 0.3;
  return 0.1;
}

/** The sector a service implies, used only when the lead has no sector of its own. */
export const SERVICE_SECTOR: Record<string, string> = { refm: 'real estate', 'project-finance': 'infrastructure' };

/** Explicit intent in free text: a call, a quote or a proposal asked for. Narrow on purpose ("capital call" is not a request). */
export const INTENT_TEXT = /\b(send|share|need|want|request|requesting|ask for|asking for|like|prepare|book|arrange|schedule)\s+(us\s+|me\s+)?(a|an|your)\s+(quick\s+)?(quote|quotation|fee proposal|proposal|fee quote|call)\b/i;

export type LeadScoreInput = {
  /** `intent`: the lead asked for a call, a quote or a proposal (the chat sets it on a pricing question). */
  lead: { requirement: string | null; recommended_service: string | null; deal_size_sar: number | string | null; timeline: string | null; stage: string; meeting_requested?: boolean; intent?: boolean };
  company: { country: string | null; city: string | null; sector: string | null; scale_sar?: number | string | null } | null;
  contact: { is_decision_maker: boolean; role_title: string | null } | null;
  engagement: { replied: boolean; clicks: number; chats: number; meetings: number };
  weights?: LeadWeights | null;
  /** Sector tiers from Settings: the credit per tier and which tiers are priority. The defaults when absent. */
  sectorTiers?: SectorTiers | null;
  decisionMakerTitles?: string[];
};

export type LeadScoreResult = {
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
  /** `known` false: no answer yet, so the factor is left out of the total (its share and points are 0). */
  factors: { factor: LeadFactor; weight: number; share: number; points: number; note: string; known: boolean }[];
  /** The weight of the known factors the score is scaled to (out of 100 with the default weights). */
  knownWeight: number;
  unknown: LeadFactor[];
  engaged: boolean;
  belowMinimum: boolean;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

const MEETING_STAGES = ['meeting_booked', 'opportunity', 'proposal', 'won'];

const sarMillions = (n: number) => (n >= 1_000_000_000 ? `SAR ${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} billion` : `SAR ${Math.round(n / 1_000_000)} million`);

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const w = input.weights ?? DEFAULT_LEAD_WEIGHTS;
  const e = input.engagement;
  const meeting = Boolean(input.lead.meeting_requested) || MEETING_STAGES.includes(input.lead.stage);
  const engaged = e.replied || e.clicks > 0 || e.chats > 0 || e.meetings > 0 || meeting;
  const sizes = [num(input.lead.deal_size_sar), num(input.company?.scale_sar)].filter((x): x is number => x !== null);
  const size = sizes.length ? Math.max(...sizes) : null;
  const belowMinimum = num(input.lead.deal_size_sar) !== null ? (num(input.lead.deal_size_sar) as number) < MINIMUM_DEAL_SIZE_SAR : size !== null && size < MINIMUM_DEAL_SIZE_SAR;

  // ICP fit: geography is 10 and sector 15 of its 25; each part counts only when known.
  const ownSector = input.company?.sector?.trim() || null;
  const sectorText = ownSector ?? (input.lead.recommended_service ? SERVICE_SECTOR[input.lead.recommended_service] ?? null : null);
  const tiers = resolveSectorTiers(input.sectorTiers);
  const sector = sectorShare(sectorText, tiers);
  const geoKnown = Boolean(`${input.company?.country ?? ''}${input.company?.city ?? ''}`.trim());
  const geo = geographyShare(input.company?.country, input.company?.city);
  const icpKnown = (geoKnown ? 0.4 : 0) + (sectorText ? 0.6 : 0);
  const icp = geo * 0.4 + sector.share * 0.6;

  const needText = (input.lead.requirement ?? '').trim();
  const need = (needText.length >= 20 ? 0.5 : needText ? 0.25 : 0) + (input.lead.recommended_service ? 0.5 : 0);
  const months = timelineMonths(input.lead.timeline);
  const authorityKnown = Boolean(input.contact && (input.contact.is_decision_maker || input.contact.role_title?.trim()));
  const authority = input.contact && (input.contact.is_decision_maker || titleMatches(input.contact.role_title, input.decisionMakerTitles ?? [])) ? 1 : authorityKnown ? 0.3 : 0;
  const engagement = e.replied || e.meetings > 0 ? 1 : e.chats > 0 ? 0.7 : e.clicks > 0 ? 0.5 : 0;
  const intent = meeting || Boolean(input.lead.intent) || INTENT_TEXT.test(needText);

  const place = geoKnown ? (geo === 1 ? ' in KSA' : geo >= 0.6 ? ' in the wider GCC' : ' outside the GCC') : '';
  const icpNote = !icpKnown ? 'fit unknown' : sectorText ? `${sector.label} sector${place}${ownSector ? '' : ' (from the service)'}` : `based${place}, sector unknown`;
  const shares: Record<LeadFactor, { share: number; note: string; known: number }> = {
    icp_fit: { share: icp, note: icpNote, known: icpKnown },
    clear_need: { share: need, note: need >= 1 ? 'a clear requirement and service' : need > 0 ? 'the need is partly defined' : 'no requirement recorded', known: need > 0 ? 1 : 0 },
    scale: { share: scaleShare(size), note: size === null ? 'size unknown' : `size about ${sarMillions(size)}`, known: size === null ? 0 : 1 },
    timeline: { share: timelineShare(months), note: months === null ? 'no timeline' : months <= 3 ? 'deciding within three months' : `deciding in about ${Math.round(months)} months`, known: months === null ? 0 : 1 },
    authority: { share: authority, note: authority === 1 ? 'talking to a decision-maker' : authorityKnown ? 'contact is not the decision-maker' : 'role unknown', known: authorityKnown ? 1 : 0 },
    engagement: { share: engagement, note: e.replied ? 'replied' : e.meetings ? 'has met' : e.chats ? 'chatted on the site' : e.clicks ? `clicked ${e.clicks} time${e.clicks === 1 ? '' : 's'}` : 'no engagement yet', known: engagement > 0 ? 1 : 0 },
    meeting_intent: { share: meeting ? 1 : 0, note: meeting ? 'asked to meet' : 'no meeting requested', known: meeting ? 1 : 0 },
  };
  const factors = LEAD_FACTORS.map((f) => {
    const s = shares[f.key];
    const weight = w[f.key] ?? 0;
    return { factor: f.key, weight, share: s.share, points: Math.round(weight * s.share * 10) / 10, note: s.note, known: s.known > 0 };
  });
  const knownWeight = Math.round(LEAD_FACTORS.reduce((a, f) => a + (w[f.key] ?? 0) * shares[f.key].known, 0) * 10) / 10;
  const raw = factors.reduce((a, f) => a + f.points, 0);
  let score = knownWeight > 0 ? Math.max(0, Math.min(100, Math.round((raw / knownWeight) * 100))) : 0;
  let temperature = temperatureFor(score);
  const reasons: string[] = [];

  if (temperature === 'hot' && (size === null || months === null)) {
    temperature = 'warm';
    score = Math.min(score, TEMPERATURE_THRESHOLDS.hot - 1);
    reasons.push(`Warm, not Hot, until the ${size === null && months === null ? 'size and timeline are' : size === null ? 'size is' : 'timeline is'} known.`);
  }
  const priority = sector.tier !== null && tiers.priority.includes(sector.tier) && size !== null && size >= MINIMUM_DEAL_SIZE_SAR && months !== null && months <= 3;
  if (priority) {
    const why = `${withIndefiniteArticle(sector.label ?? '')} sector, ${sarMillions(size as number)} and a decision within three months`;
    if (intent && temperature !== 'hot') {
      temperature = 'hot';
      score = Math.max(score, TEMPERATURE_THRESHOLDS.hot);
      reasons.splice(0, reasons.length, `Hot: ${why}, and a call, quote or proposal asked for.`);
    } else if (temperature === 'cold') {
      temperature = 'warm';
      score = Math.max(score, TEMPERATURE_THRESHOLDS.warm);
      reasons.push(`At least Warm: ${why}.`);
    }
  }
  if (meeting && temperature !== 'hot') {
    temperature = 'hot';
    score = Math.max(score, TEMPERATURE_THRESHOLDS.hot);
    reasons.splice(0, reasons.length, 'Hot: a meeting was requested.');
  }
  if (belowMinimum) {
    temperature = 'cold';
    score = Math.min(score, TEMPERATURE_THRESHOLDS.warm - 1);
    reasons.length = 0;
    reasons.push('Capped at Cold: the known size is under the SAR 50 million minimum.');
  }

  const known = factors.filter((f) => f.known);
  const top = known.filter((f) => f.share > 0).sort((a, b) => b.points - a.points).slice(0, 2);
  if (top.length) reasons.push(`Strongest: ${top.map((f) => f.note).join(' and ')}.`);
  const unknown = factors.filter((f) => !f.known && f.weight > 0).map((f) => f.factor);
  const missing = [...unknown.map((k) => (LEAD_FACTORS.find((f) => f.key === k)?.label ?? k).toLowerCase().replace('icp', 'ICP')), ...(icpKnown > 0 && !geoKnown ? ['location'] : []), ...(icpKnown > 0 && !sectorText ? ['sector'] : [])];
  const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
  if (missing.length) reasons.push(`Not yet known: ${missing.join(', ')}. Scored on the ${knownWeight} of ${totalWeight} points that are known.`);
  const gap = known.filter((f) => f.share < 1 && f.weight > 0 && (f.factor !== 'icp_fit' || icpKnown === 1)).sort((a, b) => b.weight * (1 - b.share) - a.weight * (1 - a.share))[0];
  if (gap && reasons.length < 4) reasons.push(`Biggest gap: ${gap.note}.`);
  return { score, temperature, reasons: reasons.slice(0, 4), factors, knownWeight, unknown, engaged, belowMinimum };
}
