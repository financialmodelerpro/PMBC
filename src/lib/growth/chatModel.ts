/**
 * Website chat rules (Units 4.1 and 4.2, 2026-09-23). Pure: screening what a
 * visitor writes, guarding what the assistant says, merging qualification
 * answers, routing, and the page-aware opening line. Shared by the chat API,
 * the widget and the verifier.
 *
 * What these rules guarantee, whatever the model writes:
 *   - pricing, legal, complaints and anything sensitive go to Ahmad, with a
 *     fixed reply, before any AI call;
 *   - an attempt to change the assistant's instructions gets a fixed refusal
 *     and never reaches the model as an instruction;
 *   - a reply that mentions a price or amount, an email or phone number, or
 *     its own instructions is replaced before the visitor sees it;
 *   - contact details typed into the chat are not stored without consent.
 */

import { z } from 'zod';

export const CHAT_LIMITS = { message: 1000, perMinute: 8, history: 20, reply: 1200 } as const;

export const QUALIFICATION_FIELDS = [
  { key: 'service', label: 'Service' },
  { key: 'sector', label: 'Sector' },
  { key: 'project_type', label: 'Project type' },
  { key: 'size_sar', label: 'Size (SAR)' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'decision_role', label: 'Decision role' },
  { key: 'pain_point', label: 'Pain point' },
] as const;
export type QualificationKey = (typeof QUALIFICATION_FIELDS)[number]['key'];
export type Qualification = Partial<Record<QualificationKey, string | number | null>>;

export type ScreenResult = { kind: 'ok' } | { kind: 'injection' | 'clients' | 'pricing' | 'legal' | 'complaint' | 'sensitive'; reason: string };

/** Asking who the firm's clients are: answered with a fixed reply, never by the model. */
const CLIENTS = /\b(who are|name|list|tell me) (some of |any of )?your clients\b|\bclient (list|names)\b|\bwhich (companies|clients|firms|developers|banks) (have you|did you) (worked|work) (with|for)\b|\bwho (have you|did you) work(ed)? (with|for)\b/i;
/** A reply that names clients or past engagements by name is replaced. */
const NAMES_CLIENT = /\b([Oo]ur clients (include|are)|[Ww]e (have )?(worked|work) (with|for) [A-Z][a-z]+|[Cc]lients such as|for example,? [A-Z][a-z]+ (Group|Holding|Company|Co\b))/;

const INJECTION = /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(instructions?|rules?|prompts?|directions?|guidelines)\b|\b(system prompt|your instructions|your rules|developer mode|jailbreak|act as (an?|the) |you are now|pretend (to be|you are)|reveal (your|the) (prompt|instructions)|print (your|the) (prompt|instructions)|what are your instructions)/i;
const PRICING = /\b(your|the|pacemakers'?s?) (fees?|prices?|pricing|rates?|charges?)\b|\bhow much (do|does|would|will|is|are) (you|it|this|that|pacemakers|an? \w+)\b|\bwhat (do|would) you charge\b|\b(quote|quotation|pricing|rate card|retainer|discount)\b|\bfee (proposal|estimate|range)\b/i;
const LEGAL = /\b(lawsuit|legal advice|litigation|sue|sued|suing|court|lawyer|attorney|arbitration|contract dispute|liability|regulator(y)? (breach|investigation))\b/i;
const COMPLAINT = /\b(complain|complaint|unhappy with (your|the)|refund|poor service|dissatisfied|escalate this)\b/i;
const SENSITIVE = /\b(confidential|insider|inside information|non-public|bribe|kickback|money laundering|sanction(s|ed))\b/i;

/** What a visitor wrote, before any AI sees it. */
export function screenVisitorMessage(text: string): ScreenResult {
  if (INJECTION.test(text)) return { kind: 'injection', reason: 'Tried to change the assistant instructions' };
  if (CLIENTS.test(text)) return { kind: 'clients', reason: 'Asked who the clients are' };
  if (SENSITIVE.test(text)) return { kind: 'sensitive', reason: 'Raised a sensitive matter' };
  if (LEGAL.test(text)) return { kind: 'legal', reason: 'Asked a legal question' };
  if (COMPLAINT.test(text)) return { kind: 'complaint', reason: 'Raised a complaint' };
  if (PRICING.test(text)) return { kind: 'pricing', reason: 'Asked about pricing or fees' };
  return { kind: 'ok' };
}

export const FIXED_REPLIES = {
  injection: 'I can only help with questions about how PaceMakers works and whether we can help with your situation. What are you working on?',
  clients: 'PaceMakers keeps its client relationships confidential, so I cannot name clients. I can describe the kind of work involved, or Ahmad Din can talk you through comparable engagements on a call.',
  pricing: 'Fees depend on the scope of each engagement, so Ahmad Din discusses them personally. I have passed your question to him. If you share your name and email below, he will reply directly.',
  legal: 'That is a question for Ahmad Din directly rather than for this assistant. I have passed it to him. If you share your name and email below, he will be in touch.',
  complaint: 'I am sorry to hear that. I have passed this to Ahmad Din, who will want to deal with it personally. If you share your name and email below, he will reply directly.',
  sensitive: 'That is something Ahmad Din should handle personally. I have passed it to him. If you share your name and email below, he will be in touch.',
  limit: 'Thank you for the conversation. To take it further, Ahmad Din will reply personally: share your name and email below, or use the contact page.',
  unavailable: 'The assistant is not available just now. Please use the contact page and Ahmad Din will reply.',
  unknown: 'I do not have an approved answer to that. Ahmad Din can answer it personally: share your name and email below and he will reply.',
} as const;

export type EscalationKind = 'pricing' | 'legal' | 'complaint' | 'sensitive' | 'other';

/** A fee, price or discount stated as an amount. Project sizes the visitor gave are fine to repeat. */
const MONEY = /\b(fees?|prices?|pricing|charges?|quote|rates?|retainer)\b[^.\n]{0,40}(\d|SAR|USD|riyal|dollar)|(\d[\d,.]*\s?(k|thousand|SAR|USD|riyals?|dollars?)|(SAR|USD|\$)\s?\d[\d,.]*)[^.\n]{0,30}\b(fees?|per (hour|day|month|week)|retainer|to engage us)\b|\b\d{1,3}\s?%\s?(discount|off)\b/i;
const GUARANTEE = /\bwe (can |will )?guarantee\b|\bguaranteed (approval|funding|results?|returns?|success)\b/i;
const EMAIL = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
const PHONE = /(\+?\d[\d\s()-]{7,}\d)/g;
const LEAK = /\b(system prompt|my instructions|i was instructed|i am an ai language model|as an ai model|my rules say)\b/i;
const DASH = new RegExp(`\\s?[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]\\s?`, 'g');

/**
 * What the assistant may say. A reply that states an amount (it may not quote
 * prices), leaks its instructions, or is empty is replaced; emails and phone
 * numbers are removed; dashes become commas; length is capped.
 */
export function guardReply(text: string): { text: string; flag: string | null; escalate: EscalationKind | null } {
  const t = (text ?? '').trim();
  if (!t) return { text: FIXED_REPLIES.unknown, flag: 'guard', escalate: null };
  if (MONEY.test(t)) return { text: FIXED_REPLIES.pricing, flag: 'pricing', escalate: 'pricing' };
  if (GUARANTEE.test(t)) return { text: FIXED_REPLIES.unknown, flag: 'guarantee', escalate: null };
  if (NAMES_CLIENT.test(t)) return { text: FIXED_REPLIES.clients, flag: 'clients', escalate: null };
  if (LEAK.test(t)) return { text: FIXED_REPLIES.injection, flag: 'guard', escalate: null };
  const cleaned = t.replace(EMAIL, '').replace(PHONE, '').replace(DASH, ', ').replace(/\s{3,}/g, '\n\n').slice(0, CHAT_LIMITS.reply);
  return { text: cleaned, flag: null, escalate: null };
}

/** Removes contact details from what a visitor typed, when they have not consented to storing them. */
export function redactContactDetails(text: string): string {
  return text.replace(EMAIL, '[email removed]').replace(PHONE, '[number removed]');
}

/** New answers fill gaps; a known answer is only replaced by a new non-empty one. */
export function mergeQualification(old: Qualification, next: unknown): Qualification {
  const out: Qualification = { ...old };
  if (!next || typeof next !== 'object') return out;
  for (const f of QUALIFICATION_FIELDS) {
    const v = (next as Record<string, unknown>)[f.key];
    if (v === null || v === undefined || v === '') continue;
    if (f.key === 'size_sar') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n > 0) out.size_sar = Math.round(n);
      continue;
    }
    if (f.key === 'service') {
      // A site slug when the model gave one; otherwise the visitor's words, kept for Ahmad.
      out.service = String(v).trim().slice(0, 120);
      continue;
    }
    out[f.key] = String(v).trim().slice(0, 300);
  }
  return out;
}

export function answeredCount(q: Qualification): number {
  return QUALIFICATION_FIELDS.filter((f) => q[f.key] !== null && q[f.key] !== undefined && q[f.key] !== '').length;
}

const DECISION = /\b(owner|founder|ceo|cfo|coo|chair|chairman|managing director|md|director|partner|head|president|vice president|vp|general manager|gm)\b/i;
export const isDecisionRole = (role: unknown) => typeof role === 'string' && DECISION.test(role);

export type Route = 'none' | 'hot' | 'warm' | 'cold' | 'escalated';

/**
 * Where a conversation goes. Escalated wins. Otherwise nothing is decided
 * until the visitor has answered at least three questions or asked to meet;
 * then Hot, Warm or Cold follow the temperature.
 */
export function routeFor(input: { escalated: boolean; temperature: 'hot' | 'warm' | 'cold' | null; answered: number; wantsMeeting: boolean }): Route {
  if (input.escalated) return 'escalated';
  if (!input.wantsMeeting && input.answered < 3) return 'none';
  return input.temperature ?? 'none';
}

const OPENINGS: { match: RegExp; line: string }[] = [
  { match: /^\/services\/refm/, line: 'Are you working on a real estate project that needs a development model or a lender review?' },
  { match: /^\/services\/business-valuation/, line: 'Is a valuation coming up, for a transaction, a shareholder matter or planning?' },
  { match: /^\/services\/financial-due-diligence/, line: 'Are you buying or selling, and at what stage is the deal?' },
  { match: /^\/services\/(mergers-acquisitions|transaction-advisory)/, line: 'Are you preparing a transaction? I can explain how PaceMakers usually supports one.' },
  { match: /^\/services\/project-finance/, line: 'Is this for a project that needs debt sized against its cash flows?' },
  { match: /^\/services\/financial-modeling/, line: 'What decision does the model need to support?' },
  { match: /^\/services\/investment-memorandums/, line: 'Are you preparing to approach investors or lenders?' },
  { match: /^\/services\/cfo-advisory/, line: 'What is the finance question on your desk at the moment?' },
  { match: /^\/services/, line: 'Which of these situations is closest to yours?' },
  { match: /^\/tools/, line: 'Would you like help reading your valuation result, or talking through the next step?' },
  { match: /^\/(case-studies|insights)/, line: 'Is there a situation of your own that is similar?' },
];

export function openingLine(path: string, recognised: boolean): string {
  const base = OPENINGS.find((o) => o.match.test(path))?.line ?? 'How can PaceMakers help? Tell me a little about what you are working on.';
  return recognised ? `Thank you for following the link from Ahmad's email. ${base}` : base;
}

export const chatRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/).nullable().optional(),
  page: z.string().max(300).regex(/^\/[^\s]*$/).default('/'),
  message: z.string().trim().min(1).max(CHAT_LIMITS.message).optional(),
  consent: z
    .object({
      given: z.literal(true),
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(320),
      phone: z.string().trim().max(40).optional(),
      company: z.string().trim().max(200).optional(),
      nurture: z.boolean().optional(),
    })
    .optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatResponse = {
  token: string;
  reply: string | null;
  askConsent: boolean;
  offerNurture: boolean;
  bookingUrl: string | null;
  consentText: string;
  closed: boolean;
  mock: boolean;
};
