/**
 * The Lead Score (Unit 3.5, 2026-09-23). Pure.
 *
 * Set once a lead has engaged (a reply, a click, a chat, a meeting or a
 * meeting request); before that the lead has only its Prospect Score. Seven
 * factors, weights from Growth Settings (default ICP fit 25, clear need 20,
 * scale 15, timeline 15, authority 10, engagement 10, meeting intent 5).
 *
 * Temperature: Hot 71 and over, Warm 41 to 70, Cold 40 and under.
 * A meeting request is always Hot. A known size under SAR 50 million caps the
 * lead at Cold: that rule wins even over a meeting request, because the
 * minimum is the firm's floor for taking work on.
 */

import { DEFAULT_LEAD_WEIGHTS, LEAD_FACTORS, type LeadFactor, type LeadWeights } from '../engineSettingsModel';
import { MINIMUM_DEAL_SIZE_SAR, type LeadTemperature } from '../model';
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

export type LeadScoreInput = {
  lead: { requirement: string | null; recommended_service: string | null; deal_size_sar: number | string | null; timeline: string | null; stage: string; meeting_requested?: boolean };
  company: { country: string | null; city: string | null; sector: string | null; scale_sar?: number | string | null } | null;
  contact: { is_decision_maker: boolean; role_title: string | null } | null;
  engagement: { replied: boolean; clicks: number; chats: number; meetings: number };
  weights?: LeadWeights | null;
  decisionMakerTitles?: string[];
};

export type LeadScoreResult = {
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
  factors: { factor: LeadFactor; weight: number; share: number; points: number; note: string }[];
  engaged: boolean;
  belowMinimum: boolean;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

const MEETING_STAGES = ['meeting_booked', 'opportunity', 'proposal', 'won'];

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const w = input.weights ?? DEFAULT_LEAD_WEIGHTS;
  const e = input.engagement;
  const engaged = e.replied || e.clicks > 0 || e.chats > 0 || e.meetings > 0 || Boolean(input.lead.meeting_requested) || MEETING_STAGES.includes(input.lead.stage);
  const sizes = [num(input.lead.deal_size_sar), num(input.company?.scale_sar)].filter((x): x is number => x !== null);
  const size = sizes.length ? Math.max(...sizes) : null;
  const belowMinimum = num(input.lead.deal_size_sar) !== null ? (num(input.lead.deal_size_sar) as number) < MINIMUM_DEAL_SIZE_SAR : size !== null && size < MINIMUM_DEAL_SIZE_SAR;
  const icp = input.company ? (geographyShare(input.company.country, input.company.city) * 10 + sectorShare(input.company.sector).share * 15) / 25 : 0;
  const needText = (input.lead.requirement ?? '').trim();
  const need = (needText.length >= 20 ? 0.5 : needText ? 0.25 : 0) + (input.lead.recommended_service ? 0.5 : 0);
  const months = timelineMonths(input.lead.timeline);
  const authority = input.contact ? (input.contact.is_decision_maker || titleMatches(input.contact.role_title, input.decisionMakerTitles ?? []) ? 1 : 0.3) : 0;
  const engagement = e.replied || e.meetings > 0 ? 1 : e.chats > 0 ? 0.7 : e.clicks > 0 ? 0.5 : 0;
  const intent = input.lead.meeting_requested || MEETING_STAGES.includes(input.lead.stage) ? 1 : 0;

  const shares: Record<LeadFactor, { share: number; note: string }> = {
    icp_fit: { share: icp, note: icp >= 0.8 ? 'a strong fit by geography and sector' : icp > 0 ? 'a partial fit by geography and sector' : 'fit unknown' },
    clear_need: { share: need, note: need >= 1 ? 'a clear requirement and service' : need > 0 ? 'the need is partly defined' : 'no requirement recorded' },
    scale: { share: scaleShare(size), note: size === null ? 'size unknown' : `size about SAR ${Math.round(size / 1_000_000)} million` },
    timeline: { share: timelineShare(months), note: months === null ? 'no timeline' : months <= 3 ? 'deciding within three months' : `deciding in about ${Math.round(months)} months` },
    authority: { share: authority, note: authority === 1 ? 'talking to a decision-maker' : authority > 0 ? 'contact is not the decision-maker' : 'no contact' },
    engagement: { share: engagement, note: e.replied ? 'replied' : e.meetings ? 'has met' : e.chats ? 'chatted on the site' : e.clicks ? `clicked ${e.clicks} time${e.clicks === 1 ? '' : 's'}` : 'no engagement yet' },
    meeting_intent: { share: intent, note: intent ? 'asked to meet' : 'no meeting requested' },
  };
  const factors = LEAD_FACTORS.map((f) => {
    const s = shares[f.key];
    const weight = w[f.key] ?? 0;
    return { factor: f.key, weight, share: s.share, points: Math.round(weight * s.share * 10) / 10, note: s.note };
  });
  let score = Math.max(0, Math.min(100, Math.round(factors.reduce((a, f) => a + f.points, 0))));
  let temperature = temperatureFor(score);
  const reasons: string[] = [];
  if (intent && temperature !== 'hot') {
    temperature = 'hot';
    score = Math.max(score, TEMPERATURE_THRESHOLDS.hot);
    reasons.push('Hot: a meeting was requested.');
  }
  if (belowMinimum) {
    temperature = 'cold';
    score = Math.min(score, TEMPERATURE_THRESHOLDS.warm - 1);
    reasons.unshift('Capped at Cold: the known size is under the SAR 50 million minimum.');
  }
  const top = factors.filter((f) => f.share > 0).sort((a, b) => b.points - a.points).slice(0, 2);
  const gap = factors.filter((f) => f.share < 1 && f.weight > 0).sort((a, b) => b.weight * (1 - b.share) - a.weight * (1 - a.share))[0];
  if (top.length) reasons.push(`Strongest: ${top.map((f) => f.note).join(' and ')}.`);
  if (gap && reasons.length < 3) reasons.push(`Biggest gap: ${gap.note}.`);
  return { score, temperature, reasons: reasons.slice(0, 3), factors, engaged, belowMinimum };
}
