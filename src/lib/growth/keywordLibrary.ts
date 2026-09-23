/**
 * The signal keyword library: defaults and matching (2026-09-23). Pure.
 *
 * Keywords are grouped by trigger type, so a keyword that matches suggests the
 * right trigger for the signal it finds. Groups 1 to 9 cover Saudi Arabia and
 * are on by default; group 10 (distress and restructuring) and group 11 (the
 * same terms for the wider GCC) are off by default.
 *
 * This file is the one source of the defaults: the library is seeded from it
 * and "Reset to defaults" restores it. Group 11 is generated from groups 1 to
 * 9 by putting "GCC" in place of the Saudi place names; terms that only exist
 * in Saudi Arabia (NEOM, ROSHN, Wafi, Tadawul, MISA and the like) are left out
 * of it.
 */

import { z } from 'zod';

import { TRIGGER_TYPES, type TriggerType } from './model';

export type KeywordGroupDef = { key: string; label: string; region: 'ksa' | 'gcc'; trigger: TriggerType | null; enabled: boolean; keywords: { keyword: string; trigger: TriggerType }[] };

const KSA: { key: string; label: string; trigger: TriggerType; enabled: boolean; words: string[] }[] = [
  {
    key: 'new_project',
    label: 'New project',
    trigger: 'new_project',
    enabled: true,
    words: ['new project Riyadh', 'new project Saudi Arabia', 'mixed use development Saudi', 'master plan Riyadh', 'master plan Jeddah', 'development launch Saudi Arabia', 'groundbreaking ceremony Riyadh', 'breaks ground Saudi Arabia', 'foundation stone Saudi project', 'unveils project Saudi Arabia', 'announces development Riyadh', 'new industrial city Saudi', 'logistics park Saudi Arabia', 'data centre Saudi Arabia', 'tourism project Red Sea', 'entertainment project Riyadh', 'giga project contract', 'NEOM project', 'Qiddiya project', 'Diriyah project', 'Roshn project', 'ROSHN development'],
  },
  {
    key: 'real_estate_off_plan',
    label: 'Real estate and off-plan',
    trigger: 'off_plan_registration',
    enabled: true,
    words: ['off plan launch Saudi', 'off plan project Riyadh', 'Wafi registration', 'Wafi programme project', 'escrow account real estate Saudi', 'residential compound Riyadh', 'villas launch Jeddah', 'apartment project Riyadh', 'hotel development Saudi Arabia', 'serviced apartments Riyadh', 'retail mall Saudi Arabia', 'warehouse development Saudi', 'build to rent Saudi Arabia', 'real estate developer Saudi Arabia', 'land acquisition Riyadh', 'plot acquisition Saudi Arabia', 'real estate fund Saudi', 'REIT Saudi Arabia'],
  },
  {
    key: 'fundraising_debt',
    label: 'Fundraising and debt',
    trigger: 'fundraising_debt',
    enabled: true,
    words: ['raises funding Saudi Arabia', 'secures financing Riyadh', 'closes funding round Saudi', 'series A Saudi Arabia', 'series B Saudi Arabia', 'pre IPO round Saudi', 'private placement Saudi Arabia', 'signs facility agreement Saudi', 'syndicated loan Saudi Arabia', 'murabaha facility Saudi', 'sukuk issuance Saudi Arabia', 'project finance Saudi Arabia', 'development finance Riyadh', 'bridge financing Saudi', 'refinancing Saudi company', 'secures credit facility Riyadh', 'SAR million investment', 'USD million investment Saudi', 'investment agreement signed Saudi'],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    trigger: 'acquisition_jv',
    enabled: true,
    words: ['acquires stake Saudi Arabia', 'acquisition Riyadh', 'acquires company Saudi', 'completes acquisition Saudi Arabia', 'merger Saudi company', 'joint venture Saudi Arabia', 'signs JV agreement Riyadh', 'strategic partnership Saudi Arabia', 'divests stake Saudi', 'sells subsidiary Saudi Arabia', 'management buyout Saudi', 'exits investment Saudi Arabia', 'due diligence Saudi deal'],
  },
  {
    key: 'capital_markets',
    label: 'Capital markets',
    trigger: 'capital_market_activity',
    enabled: true,
    words: ['IPO Saudi Arabia', 'Tadawul listing', 'Nomu parallel market listing', 'announces IPO intention Saudi', 'CMA approves offering', 'rights issue Saudi Arabia', 'capital increase Saudi company', 'book building Saudi IPO', 'IPO prospectus Saudi'],
  },
  {
    key: 'market_entry',
    label: 'Market entry',
    trigger: 'market_entry',
    enabled: true,
    words: ['enters Saudi market', 'opens Riyadh office', 'regional headquarters Riyadh', 'RHQ programme Saudi', 'MISA licence', 'MISA investment licence', 'expands into Saudi Arabia', 'establishes Saudi subsidiary', 'foreign investor Saudi Arabia', 'launches operations Riyadh'],
  },
  {
    key: 'finance_leadership',
    label: 'Finance leadership',
    trigger: 'finance_leadership_hire',
    enabled: true,
    words: ['appoints CFO Saudi Arabia', 'new chief financial officer Riyadh', 'appoints finance director Saudi', 'chief investment officer appointed Saudi', 'head of corporate finance Riyadh', 'appoints managing director Saudi', 'new CEO Saudi company', 'hires finance team Riyadh'],
  },
  {
    key: 'contract_awards',
    label: 'Contract awards',
    trigger: 'contract_award',
    enabled: true,
    words: ['awarded contract Saudi Arabia', 'wins tender Riyadh', 'EPC contract Saudi Arabia', 'construction contract awarded Saudi', 'signs agreement giga project', 'awarded SAR contract', 'wins project Saudi Arabia', 'letter of award Saudi'],
  },
  {
    key: 'expansion_capex',
    label: 'Expansion and capex',
    trigger: 'expansion',
    enabled: true,
    words: ['expansion plan Saudi Arabia', 'new factory Saudi Arabia', 'capacity expansion Riyadh', 'new plant Jeddah', 'opens facility Saudi Arabia', 'capital expenditure plan Saudi', 'localisation project Saudi', 'manufacturing investment Saudi Arabia'],
  },
  {
    key: 'distress_restructuring',
    label: 'Distress and restructuring',
    trigger: 'other',
    enabled: false,
    words: ['restructuring Saudi company', 'financial restructuring Riyadh', 'debt restructuring Saudi Arabia', 'cost optimisation Saudi company', 'turnaround Saudi business'],
  },
];

/** The GCC places group 11 stands for, spelled out for the search prompt. */
export const GCC_PLACES = ['UAE', 'Dubai', 'Abu Dhabi', 'Qatar', 'Doha', 'Kuwait', 'Bahrain', 'Oman'];

/** Terms that only exist in Saudi Arabia: kept out of the GCC group. */
const SAUDI_ONLY = /\b(NEOM|Qiddiya|Diriyah|ROSHN|Roshn|Wafi|Tadawul|Nomu|MISA|RHQ|CMA|Red Sea|giga project|SAR)\b/;

/** A Saudi keyword with "GCC" in place of its Saudi place names; null when it only makes sense in Saudi Arabia. */
export function gccVariant(keyword: string): string | null {
  if (SAUDI_ONLY.test(keyword)) return null;
  const out = keyword
    .replace(/\bSaudi Arabia\b/g, 'GCC')
    .replace(/\bSaudi\b/g, 'GCC')
    .replace(/\b(Riyadh|Jeddah)\b/g, 'GCC')
    .replace(/\s+/g, ' ')
    .trim();
  return out === keyword || !/\bGCC\b/.test(out) ? null : out;
}

function buildDefaults(): KeywordGroupDef[] {
  const groups: KeywordGroupDef[] = KSA.map((g) => ({ key: g.key, label: g.label, region: 'ksa' as const, trigger: g.trigger, enabled: g.enabled, keywords: g.words.map((keyword) => ({ keyword, trigger: g.trigger })) }));
  const seen = new Set<string>();
  const gcc: { keyword: string; trigger: TriggerType }[] = [];
  for (const g of KSA.slice(0, 9)) {
    for (const w of g.words) {
      const v = gccVariant(w);
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        gcc.push({ keyword: v, trigger: g.trigger });
      }
    }
  }
  groups.push({ key: 'wider_gcc', label: `Wider GCC (${GCC_PLACES.join(', ')})`, region: 'gcc', trigger: null, enabled: false, keywords: gcc });
  return groups;
}

export const DEFAULT_KEYWORD_GROUPS: readonly KeywordGroupDef[] = buildDefaults();

export const KEYWORD_LIMITS = { keyword: 120, perGroup: 200 } as const;

// ---------------------------------------------------------------------------
// Matching: which keyword a piece of text fits, to suggest its trigger
// ---------------------------------------------------------------------------

/** Place words are left out of matching: the library is Saudi first, and a story rarely repeats the place in every sentence. */
const PLACE = /^(saudi|arabia|ksa|riyadh|jeddah|dammam|gcc|uae|dubai|abu|dhabi|qatar|doha|kuwait|bahrain|oman|kingdom)$/i;
const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'into', 'for', 'and', 'to', 'on', 'at', 'with', 'company', 'project']);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(Boolean);
const stem = (w: string) => (w.length > 3 ? w.replace(/(ing|ed|es|s)$/, '').replace(/e$/, '') : w);

/** The words that must appear for a keyword to match: no place names, no filler. */
export function keywordTerms(keyword: string): string[] {
  const t = words(keyword).filter((w) => !PLACE.test(w) && !STOP.has(w));
  return t.length ? t : words(keyword).filter((w) => !STOP.has(w));
}

export type MatchableKeyword = { id: string; keyword: string; trigger: TriggerType; enabled: boolean };

/**
 * The enabled keyword that best fits the text: every one of its terms appears
 * (allowing simple plurals and tenses), and the most specific match wins.
 * Null when none fits.
 */
export function suggestKeyword<K extends MatchableKeyword>(text: string, keywords: K[]): K | null {
  const have = new Set(words(text).map(stem));
  let best: { k: K; n: number } | null = null;
  for (const k of keywords) {
    if (!k.enabled) continue;
    const terms = keywordTerms(k.keyword);
    if (!terms.length || !terms.every((t) => have.has(stem(t)))) continue;
    if (!best || terms.length > best.n) best = { k, n: terms.length };
  }
  return best?.k ?? null;
}

// ---------------------------------------------------------------------------
// Changes from the Settings screen
// ---------------------------------------------------------------------------

const TRIGGER_VALUES = TRIGGER_TYPES.map((t) => t.value) as [TriggerType, ...TriggerType[]];
const keywordText = z.string().trim().min(2, 'At least two characters').max(KEYWORD_LIMITS.keyword, `At most ${KEYWORD_LIMITS.keyword} characters`);
const groupKey = z.string().regex(/^[a-z0-9_]{2,40}$/);
const keywordId = z.string().min(3).max(80);

export const keywordChangeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('group_toggle'), group: groupKey, enabled: z.boolean() }),
  z.object({ action: z.literal('keyword_toggle'), id: keywordId, enabled: z.boolean() }),
  z.object({ action: z.literal('keyword_edit'), id: keywordId, keyword: keywordText, trigger: z.enum(TRIGGER_VALUES) }),
  z.object({ action: z.literal('keyword_add'), group: groupKey, keyword: keywordText, trigger: z.enum(TRIGGER_VALUES) }),
  z.object({ action: z.literal('keyword_remove'), id: keywordId }),
  z.object({ action: z.literal('reset') }),
]);
