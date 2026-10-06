/**
 * The Prospect Score (Unit 2.3, 2026-09-23). Pure: no database access, so the
 * scoring job, the company page and the verifier share one answer.
 *
 * Seven factors, each worth its weight from Growth Settings (default:
 * geography 10, sector 15, project signal 20, funding or transaction signal
 * 20, scale 15, decision-maker 10, recency 10; they always sum to 100). Each
 * factor earns a share of its weight between 0 and 1 by the rules below; the
 * score is the rounded total.
 *
 * Bands: Priority 80 and over, Good 60 to 79, Watch 40 to 59, Low under 40.
 * Hard rule: a known deal or project size under SAR 50 million is Low
 * whatever the score.
 *
 * Scored on what is known (recalibrated 2026-10-06): a factor with no answer
 * (location, sector, size, or no contact on file) is left out rather than
 * scored zero, and the total is scaled to the weight of the known factors.
 * The three signal factors are always known: the engine watches for signals,
 * so having none is an answer. The unknown factors are listed in the reasons.
 *
 * Targeting rules come from the approved Knowledge Base: its decision-maker
 * titles count a contact as a decision-maker, and its excluded work is
 * flagged in the reasons for Ahmad to judge.
 */

import { MINIMUM_DEAL_SIZE_SAR, type ProspectBand, type TriggerType } from '../model';
import { DEFAULT_SCORING_WEIGHTS, SCORING_FACTORS, resolveSectorTiers, type ScoringFactor, type ScoringWeights, type SectorTier, type SectorTiers } from '../engineSettingsModel';

export const BAND_THRESHOLDS = { priority: 80, good: 60, watch: 40 } as const;

export function bandFor(score: number): ProspectBand {
  if (score >= BAND_THRESHOLDS.priority) return 'priority';
  if (score >= BAND_THRESHOLDS.good) return 'good';
  if (score >= BAND_THRESHOLDS.watch) return 'watch';
  return 'low';
}

export const PROJECT_TRIGGERS: readonly TriggerType[] = ['new_project', 'off_plan_registration', 'contract_award', 'expansion', 'market_entry'];
export const FUNDING_TRIGGERS: readonly TriggerType[] = ['fundraising_debt', 'acquisition_jv', 'capital_market_activity'];
/** A finance leadership hire often precedes a transaction: half credit on the funding factor. */
export const HALF_FUNDING_TRIGGERS: readonly TriggerType[] = ['finance_leadership_hire'];
/** Signals older than this do not count as project or funding evidence. */
export const SIGNAL_RELEVANCE_DAYS = 365;

const KSA = /\b(saudi|ksa|kingdom of saudi arabia|riyadh|jeddah|dammam|khobar|makkah|mecca|madinah|medina|neom|alula|tabuk|abha|jubail|yanbu)\b/i;
const GCC = /\b(uae|united arab emirates|emirates|dubai|abu dhabi|sharjah|qatar|doha|kuwait|bahrain|manama|oman|muscat)\b/i;

/** Geography share: KSA 1, the wider GCC 0.6, elsewhere 0.2, unknown 0. */
export function geographyShare(country: string | null | undefined, city?: string | null): number {
  const text = `${country ?? ''} ${city ?? ''}`.trim();
  if (!text) return 0;
  if (KSA.test(text)) return 1;
  if (GCC.test(text)) return 0.6;
  return 0.2;
}

/**
 * Sector tier, read from the sector text; the credit per tier comes from
 * Settings (`sector_tiers`, migration 096). By default real estate earns
 * 100 per cent, infrastructure, energy and industrial 75, investment 60,
 * healthcare, education and services 45, any other known sector 25. Unknown is
 * not scored.
 */
export const SECTOR_SHARES: readonly { tier: SectorTier; label: string; pattern: RegExp }[] = [
  { tier: 'real_estate', label: 'real estate', pattern: /real estate|property|properties|developer|development|residential|mixed[- ]use|hospitality|hotel|reit|master[- ]?plan|giga[- ]?project/i },
  { tier: 'infrastructure', label: 'infrastructure, energy or industrial', pattern: /infrastructure|energy|power|utilit|renewable|solar|oil|gas|petro|biofuel|waste|data cent|construction|contractor|industrial|manufactur|mining|logistics|transport|water|desalination/i },
  { tier: 'investment', label: 'investment', pattern: /family office|investment|investor|private equity|fund|holding|asset manage|venture/i },
  { tier: 'services', label: 'healthcare, education or services', pattern: /health|hospital|clinic|education|school|university|retail|food|agri|tourism|entertainment|telecom|technology|fintech|services/i },
];

export function sectorShare(sector: string | null | undefined, tiers?: SectorTiers | null): { share: number; label: string | null; tier: SectorTier | null } {
  if (!sector?.trim()) return { share: 0, label: null, tier: null };
  const credit = resolveSectorTiers(tiers).credit;
  for (const s of SECTOR_SHARES) if (s.pattern.test(sector)) return { share: credit[s.tier] / 100, label: s.label, tier: s.tier };
  return { share: credit.other / 100, label: 'other', tier: 'other' };
}

/** Scale share from the largest known size in SAR. Null when unknown. */
export function scaleShare(sizeSar: number | null): number {
  if (sizeSar === null) return 0;
  if (sizeSar >= 1_000_000_000) return 1;
  if (sizeSar >= 500_000_000) return 0.85;
  if (sizeSar >= 200_000_000) return 0.7;
  if (sizeSar >= 100_000_000) return 0.55;
  if (sizeSar >= MINIMUM_DEAL_SIZE_SAR) return 0.4;
  return 0;
}

/** Recency share from the newest signal's age in days. */
export function recencyShare(ageDays: number | null): number {
  if (ageDays === null) return 0;
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.7;
  if (ageDays <= 180) return 0.4;
  if (ageDays <= SIGNAL_RELEVANCE_DAYS) return 0.2;
  return 0;
}

export type ScoreInput = {
  company: { country: string | null; city: string | null; sector: string | null; description?: string | null; notes?: string | null; scale_sar?: number | string | null };
  leads: { deal_size_sar: number | string | null }[];
  contacts: { is_decision_maker: boolean; role_title: string | null }[];
  signals: { trigger_type: TriggerType; signal_date: string; status: string }[];
  weights?: ScoringWeights | null;
  /** Sector tiers from Settings; the defaults when absent or malformed. */
  sectorTiers?: SectorTiers | null;
  targeting?: { decisionMakerTitles: string[]; excludedWork: string[] };
  now?: Date;
};

/** `known` false: no answer yet, so the factor is left out of the total (its share and points are 0). */
export type FactorResult = { factor: ScoringFactor; weight: number; share: number; points: number; note: string; known: boolean };

export type ScoreResult = {
  score: number;
  band: ProspectBand;
  factors: FactorResult[];
  reasons: string[];
  /** The known size in SAR, or null when unknown. */
  sizeSar: number | null;
  belowMinimum: boolean;
  /** The weight of the known factors the score is scaled to. */
  knownWeight: number;
  unknown: ScoringFactor[];
  excludedMatches: string[];
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const sar = (n: number) => (n >= 1_000_000_000 ? `SAR ${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)} billion` : `SAR ${Math.round(n / 1_000_000)} million`);

export function titleMatches(title: string | null, patterns: string[]): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return patterns.some((p) => p.trim().length > 1 && t.includes(p.trim().toLowerCase()));
}

export function scoreProspect(input: ScoreInput): ScoreResult {
  const weights = input.weights ?? DEFAULT_SCORING_WEIGHTS;
  const now = input.now ?? new Date();
  const live = input.signals.filter((s) => s.status !== 'dismissed');
  const ageDays = (d: string) => Math.floor((now.getTime() - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
  const relevant = live.filter((s) => ageDays(s.signal_date) <= SIGNAL_RELEVANCE_DAYS);

  const sizes = [num(input.company.scale_sar), ...input.leads.map((l) => num(l.deal_size_sar))].filter((x): x is number => x !== null);
  const sizeSar = sizes.length ? Math.max(...sizes) : null;
  const belowMinimum = sizeSar !== null && sizeSar < MINIMUM_DEAL_SIZE_SAR;

  const geo = geographyShare(input.company.country, input.company.city);
  const sector = sectorShare(input.company.sector, input.sectorTiers);
  const project = relevant.find((s) => PROJECT_TRIGGERS.includes(s.trigger_type));
  const funding = relevant.find((s) => FUNDING_TRIGGERS.includes(s.trigger_type));
  const halfFunding = relevant.find((s) => HALF_FUNDING_TRIGGERS.includes(s.trigger_type));
  const titles = input.targeting?.decisionMakerTitles ?? [];
  const dm = input.contacts.find((c) => c.is_decision_maker || titleMatches(c.role_title, titles));
  const newest = live.length ? Math.min(...live.map((s) => ageDays(s.signal_date))) : null;

  const known: Record<ScoringFactor, boolean> = { geography: geo > 0, sector: Boolean(sector.label), project_signal: true, funding_signal: true, scale: sizeSar !== null, decision_maker: input.contacts.length > 0, recency: true };
  const shares: Record<ScoringFactor, { share: number; note: string }> = {
    geography: { share: geo, note: geo === 1 ? 'based in KSA' : geo >= 0.6 ? 'based in the wider GCC' : geo > 0 ? 'based outside the GCC' : 'location unknown' },
    sector: { share: sector.share, note: sector.label ? `${sector.label} sector` : 'sector unknown' },
    project_signal: { share: project ? 1 : 0, note: project ? 'a recent project signal' : 'no recent project signal' },
    funding_signal: { share: funding ? 1 : halfFunding ? 0.5 : 0, note: funding ? 'a recent funding or transaction signal' : halfFunding ? 'a finance leadership hire' : 'no funding or transaction signal' },
    scale: { share: scaleShare(sizeSar), note: sizeSar === null ? 'size unknown' : `size about ${sar(sizeSar)}` },
    decision_maker: { share: dm ? 1 : input.contacts.length ? 0.3 : 0, note: dm ? 'a decision-maker on file' : input.contacts.length ? 'contacts on file, none a decision-maker' : 'no contact on file' },
    recency: { share: recencyShare(newest), note: newest === null ? 'no signals yet' : newest <= 30 ? 'latest signal this month' : `latest signal ${newest} days ago` },
  };

  const factors: FactorResult[] = SCORING_FACTORS.map((f) => {
    const w = weights[f.key] ?? 0;
    const s = shares[f.key];
    return { factor: f.key, weight: w, share: s.share, points: Math.round(w * s.share * 10) / 10, note: s.note, known: known[f.key] };
  });
  const knownWeight = factors.reduce((a, f) => a + (f.known ? f.weight : 0), 0);
  const unknown = factors.filter((f) => !f.known && f.weight > 0).map((f) => f.factor);
  const raw = factors.reduce((a, f) => a + f.points, 0);
  const score = knownWeight > 0 ? Math.max(0, Math.min(100, Math.round((raw / knownWeight) * 100))) : 0;
  const band = belowMinimum ? 'low' : bandFor(score);

  const text = `${input.company.sector ?? ''} ${input.company.description ?? ''} ${input.company.notes ?? ''}`.toLowerCase();
  const excludedMatches = (input.targeting?.excludedWork ?? []).filter((w) => w.trim().length > 2 && text.includes(w.trim().toLowerCase()));

  const reasons: string[] = [];
  if (belowMinimum && sizeSar !== null) reasons.push(`Low regardless of score: the known size, ${sar(sizeSar)}, is under the SAR 50 million minimum.`);
  const strengths = factors.filter((f) => f.share > 0).sort((a, b) => b.points - a.points);
  const gaps = factors.filter((f) => f.known && f.share < 1 && f.weight > 0).sort((a, b) => b.weight * (1 - b.share) - a.weight * (1 - a.share));
  if (strengths.length) reasons.push(`Strongest: ${strengths.slice(0, 2).map((f) => f.note).join(' and ')} (${strengths.slice(0, 2).reduce((a, f) => a + f.points, 0)} of ${strengths.slice(0, 2).reduce((a, f) => a + f.weight, 0)} points).`);
  if (unknown.length) reasons.push(`Not yet known: ${unknown.map((k) => (SCORING_FACTORS.find((f) => f.key === k)?.label ?? k).toLowerCase()).join(', ')}. Scored on the ${knownWeight} of ${factors.reduce((a, f) => a + f.weight, 0)} points that are known.`);
  if (excludedMatches.length && reasons.length < 4) reasons.push(`Check the targeting rules: mentions excluded work (${excludedMatches.join(', ')}).`);
  if (gaps.length && reasons.length < 4) reasons.push(`Biggest gap: ${gaps[0].note} (${gaps[0].points} of ${gaps[0].weight} points).`);
  if (reasons.length < 2) reasons.push(`Score ${score} of 100 from the seven factors.`);

  return { score, band, factors, reasons: reasons.slice(0, 4), sizeSar, belowMinimum, knownWeight, unknown, excludedMatches };
}
