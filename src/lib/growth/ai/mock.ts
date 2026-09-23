/**
 * The mock AI provider (Unit 1.5, 2026-09-22): realistic sample answers, free,
 * used whenever ANTHROPIC_API_KEY is not set so every AI feature can be built
 * and tested without a key.
 *
 * Every answer starts with MOCK_LABEL, so mock text can never be mistaken for
 * a real model's output, wherever it is shown or stored. The samples describe
 * made-up companies and never state a PaceMakers fact.
 */

import { JSON_SAMPLES, sampleUrls } from './mockSamples';
import type { AiProvider, ProviderRequest, ProviderResponse } from './provider';

export const MOCK_LABEL = '[MOCK AI OUTPUT: sample text, not written by Claude]';
export const MOCK_MODEL = 'mock';

const SAMPLES: Record<string, string> = {
  signal_research: [
    'Signal: Al Noor Development Co. (sample company) registered an off-plan residential project of 420 units in north Riyadh.',
    'Evidence: https://example.invalid/sample-registration',
    'Why it matters: a registered off-plan project usually needs a lender-ready financial model and a feasibility update before escrow drawdowns.',
    'Suggested service: Real Estate Financial Modeling.',
  ].join('\n'),
  prospect_brief: [
    'Company: Gulf Horizon Logistics (sample company), Dammam, logistics and warehousing.',
    'Decision-maker: the Chief Financial Officer (name to be confirmed).',
    'Likely need: a valuation ahead of a minority stake sale mentioned in a sample press release.',
    'Prospect score: 68 (Good). Reasons: sector fit, deal size likely above SAR 50 million, finance leadership in place.',
  ].join('\n'),
  outreach_draft: [
    'Subject: Your planned stake sale',
    '',
    'Dear [Name],',
    '',
    'I read that [Company] is preparing a minority stake sale. A well-supported valuation usually shortens those conversations. If it would help, I would be glad to share how we approach them.',
    '',
    'Kind regards,',
    '[Sender]',
  ].join('\n'),
  qualification: [
    'Summary: the visitor is exploring a feasibility study for a hospitality project in Jeddah.',
    'Deal size: about SAR 120 million (above the minimum).',
    'Timeline: decision within three months.',
    'Recommendation: offer a meeting.',
  ].join('\n'),
  meeting_brief: [
    'Meeting brief (sample): 30 minutes with the Finance Director of a sample industrial group.',
    'Their situation: refinancing a plant expansion; lenders asked for an updated model.',
    'Questions to ask: current covenants, model ownership, decision timeline.',
  ].join('\n'),
  test: 'This is a sample answer from the mock provider. The AI layer, budget check, usage record and audit log all ran as they will with a real model.',
};

/** Roughly four characters per token, as a stand-in for real counts. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export const mockProvider: AiProvider = {
  name: 'mock',
  isMock: true,
  async call(req: ProviderRequest): Promise<ProviderResponse> {
    const json = JSON_SAMPLES[req.purpose]?.(req);
    const sample = json !== undefined ? JSON.stringify(json, null, 2) : SAMPLES[req.purpose] ?? `A sample answer for "${req.purpose}" from the mock provider.`;
    const text = `${MOCK_LABEL}\n\n${sample}`;
    const prompt = [req.system ?? '', ...req.messages.map((m) => m.content)].join('\n');
    return {
      text,
      model: MOCK_MODEL,
      inputTokens: estimateTokens(prompt),
      outputTokens: Math.min(req.maxTokens, estimateTokens(text)),
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      refused: false,
      webSearchRequests: 0,
      sourceUrls: json !== undefined ? sampleUrls(json) : [],
    };
  },
};
