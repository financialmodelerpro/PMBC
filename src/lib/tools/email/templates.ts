/**
 * The two emails a tool lead sends, built from editable templates.
 *
 * `tool_valuation_results` goes to the visitor with the PDF attached.
 * `tool_lead_alert` goes to the firm. Both are rows in `email_templates`
 * (migration 078), edited at /admin/email-templates, with the defaults below
 * used when the row is missing or unreadable, so a lead is never left without
 * its email because a migration has not run.
 *
 * VARIABLES
 * Plain variables are HTML-escaped (`renderTemplate`). `*_block` variables are
 * markup built here from escaped values, inserted as-is.
 *
 *   results: name, email, company, equity_range, midpoint, weighted_value,
 *            stake_value, ev_range, wacc,
 *            methods, valuation_date, currency, booking_url,
 *            summary_block, booking_button_block
 *   alert:   tool_name, name, email, company, company_suffix, purpose,
 *            deal_size, below_minimum, below_minimum_suffix, country, industry,
 *            equity_range, midpoint, wacc, follow_up, is_test, dashboard_url,
 *            details_block, dashboard_button_block
 *
 * The builders are pure given a template, so `npm run verify-tool-email-pdf`
 * checks the rendered HTML without a database.
 */

import { BRAND, NEUTRALS } from '@/lib/brand/letterhead';
import { renderSubject, renderTemplate } from '@/lib/email/render';

import { PURPOSES } from '../valuation/data';
import type { ValuationResult } from '../valuation/engine';
import { equityFloorNote, fmtPct, headline, methodsUsed } from '../valuation/format';

export type EmailTemplate = { subject: string; body_html: string; enabled: boolean };

export const RESULTS_TEMPLATE_KEY = 'tool_valuation_results';
export const ALERT_TEMPLATE_KEY = 'tool_lead_alert';

export const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  [RESULTS_TEMPLATE_KEY]: {
    subject: 'Your indicative valuation: {{equity_range}}',
    body_html: `<p style="margin:0 0 16px;">Dear {{name}},</p>
<p style="margin:0 0 16px;">Thank you for using the PaceMakers business valuation tool. Your indicative results are summarised below, and the full report is attached as a PDF.</p>
{{summary_block}}
<p style="margin:16px 0;">The range blends a discounted cash flow with a comparables check, using Damodaran market data for your industry and country. It is indicative only and is not a valuation opinion.</p>
<p style="margin:0 0 16px;">If you would like to test the assumptions, or discuss what an independent valuation would cover, book a free 30 minute call with our team.</p>
{{booking_button_block}}`,
    enabled: true,
  },
  [ALERT_TEMPLATE_KEY]: {
    subject: 'New {{tool_name}} lead: {{name}}{{company_suffix}}{{below_minimum_suffix}}',
    body_html: `<p style="margin:0 0 16px;">A new lead has come in from the {{tool_name}} tool.</p>
{{details_block}}
{{dashboard_button_block}}`,
    enabled: true,
  },
};

// The letterhead palette, as the PDF report uses: navy base, green accent, gold only in the shell's tagline.
const NAVY = BRAND.navy;
const GREEN = BRAND.green;
const TEXT = NEUTRALS.text;
const MUTED = BRAND.grey;
const BORDER = NEUTRALS.border;
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Replaces `{{x_block}}` with trusted markup, then renders the rest with escaping. */
export function renderWithBlocks(source: string, vars: Record<string, string>, blocks: Record<string, string>): string {
  const placeholders = new Map<string, string>();
  let i = 0;
  const withTokens = source.replace(/\{\{\s*([a-zA-Z0-9_]+_block)\s*\}\}/g, (match, key: string) => {
    if (!(key in blocks)) return match;
    const token = `@@BLOCK${i++}@@`;
    placeholders.set(token, blocks[key]);
    return token;
  });
  let out = renderTemplate(withTokens, vars);
  for (const [token, markup] of placeholders) out = out.split(token).join(markup);
  return out;
}

function table(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;border:1px solid ${BORDER};">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 14px;border-bottom:1px solid ${BORDER};font-family:${SANS};font-size:13px;color:${MUTED};width:42%;">${escapeHtml(k)}</td><td style="padding:10px 14px;border-bottom:1px solid ${BORDER};font-family:${SANS};font-size:14px;color:${TEXT};font-weight:600;">${escapeHtml(v)}</td></tr>`,
  )
  .join('\n')}
</table>`;
}

/**
 * A bulletproof button.
 *
 * The padding and the colour are on the table cell, with `bgcolor` as well as
 * the style, because Outlook's Word renderer ignores padding on an `<a>`: with
 * the padding on the link, as it was until 2026-09-16, Outlook drew the label
 * pressed against the edges of its box. Every client honours cell padding. The
 * link keeps a line height so the cell does not collapse around it.
 */
export function button(href: string, label: string, tone: 'green' | 'navy' = 'green'): string {
  const bg = tone === 'green' ? GREEN : NAVY;
  const fg = '#FFFFFF';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;border-collapse:separate;"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:2px;padding:13px 26px;mso-padding-alt:13px 26px;">
<a href="${escapeHtml(href)}" style="display:inline-block;font-family:${SANS};font-size:13px;line-height:18px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${fg};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/* ------------------------------------------------------------------------ */

export type ResultsEmailInput = {
  template: EmailTemplate;
  name: string;
  email: string;
  company: string | null;
  result: ValuationResult;
  /** The tracked booking link, `/api/tools/book?t=...&src=email`, absolute. */
  bookingHref: string;
};

export function buildResultsEmail(i: ResultsEmailInput): { subject: string; body: string } {
  const h = headline(i.result);
  const methods = methodsUsed(i.result).join(', ');
  const rows: [string, string][] = [
    ['Indicative equity value', h.equityRange],
    ['Base case', h.midpoint],
    ...(h.weighted ? ([['Probability-weighted value', h.weighted]] as [string, string][]) : []),
    ...(h.stakeRange && h.stakeLabel ? ([[`Value of ${h.stakeLabel}`, h.stakeRange]] as [string, string][]) : []),
    ['Enterprise value', h.evRange],
    ['WACC', h.wacc],
    ['Methods', methods],
    ['Valuation date', h.asAt.replace(/^as at /, '').replace(/^end of/, 'End of')],
  ];
  const floor = equityFloorNote(i.result.equityFloor);
  const summary =
    table(rows) +
    (floor
      ? `<p style="margin:0 0 16px;padding:10px 14px;border-left:3px solid ${NAVY};background:${NEUTRALS.navyTint};font-family:${SANS};font-size:13px;color:${TEXT};">${escapeHtml(floor)}</p>`
      : '');
  const vars = {
    name: i.name,
    email: i.email,
    company: i.company ?? '',
    equity_range: h.equityRange,
    midpoint: h.midpoint,
    weighted_value: h.weighted ?? '',
    stake_value: h.stakeRange ?? '',
    ev_range: h.evRange,
    wacc: h.wacc,
    methods,
    valuation_date: h.valuationDate,
    currency: i.result.currency.code,
    booking_url: i.bookingHref,
  };
  return {
    subject: renderSubject(i.template.subject, vars),
    body: renderWithBlocks(i.template.body_html, vars, {
      summary_block: summary,
      booking_button_block: button(i.bookingHref, 'Book a free call'),
    }),
  };
}

export type AlertEmailInput = {
  template: EmailTemplate;
  toolName: string;
  lead: {
    name: string;
    email: string;
    company: string | null;
    purpose: string | null;
    dealSizeLabel: string;
    belowMinimum: boolean;
    country: string | null;
    industry: string | null;
    followUp: boolean;
    isTest: boolean;
  };
  result: ValuationResult;
  dashboardUrl: string;
};

export function buildAlertEmail(i: AlertEmailInput): { subject: string; body: string } {
  const h = headline(i.result);
  const l = i.lead;
  const purpose = PURPOSES.find((p) => p.value === l.purpose)?.label ?? l.purpose ?? 'Not given';
  const rows: [string, string][] = [
    ['Name', l.name],
    ['Email', l.email],
    ['Company', l.company || 'Not given'],
    ['Purpose', purpose],
    ['Planned transaction size', l.dealSizeLabel],
    ['Below minimum mandate size', l.belowMinimum ? 'Yes' : 'No'],
    ['Country', l.country ?? ''],
    ['Industry', l.industry ?? ''],
    ['Indicative equity value', h.equityRange],
    ['Base case', h.midpoint],
    ['WACC', h.wacc],
    ['Follow-up email consent', l.followUp ? 'Yes' : 'No'],
  ];
  if (l.isTest) rows.unshift(['Test lead', 'Yes, submitted in Admin preview']);
  const vars = {
    tool_name: i.toolName,
    name: l.name,
    email: l.email,
    company: l.company ?? '',
    company_suffix: l.company ? `, ${l.company}` : '',
    purpose,
    deal_size: l.dealSizeLabel,
    below_minimum: l.belowMinimum ? 'Yes' : 'No',
    below_minimum_suffix: (l.belowMinimum ? ' (below minimum)' : '') + (l.isTest ? ' [TEST]' : ''),
    country: l.country ?? '',
    industry: l.industry ?? '',
    equity_range: h.equityRange,
    midpoint: h.midpoint,
    wacc: fmtPct(i.result.wacc.wacc),
    follow_up: l.followUp ? 'Yes' : 'No',
    is_test: l.isTest ? 'Yes' : 'No',
    dashboard_url: i.dashboardUrl,
  };
  return {
    subject: renderSubject(i.template.subject, vars),
    body: renderWithBlocks(i.template.body_html, vars, {
      details_block: table(rows),
      dashboard_button_block: button(i.dashboardUrl, 'Open the lead', 'navy'),
    }),
  };
}
