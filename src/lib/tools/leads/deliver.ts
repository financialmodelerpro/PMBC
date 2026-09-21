/**
 * Sends a saved lead's two emails: the results email with the PDF report to the
 * visitor, and the alert to the firm. Records the outcome of each on the lead
 * and as events.
 *
 * Runs after the response has been sent (the lead route schedules it with
 * `after`), so a slow PDF render or a Brevo timeout never delays the visitor's
 * results. Never throws: every failure is written to the lead instead, where
 * the admin detail view shows it and offers a resend.
 */

import { findTool } from '@/config/tools';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { sendEmail, type SendEmailResult } from '@/lib/email/send';
import { baseLayoutBranded } from '@/lib/email/templates/_base';
import { SITE_HREF } from '@/lib/brand/letterhead';
import { bookingLinkFor } from './bookingLinkStore';
import { resumeLinkForLead } from './resumeLinks';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { EmailStatus, ToolLeadRow } from '../db';
import {
  ALERT_TEMPLATE_KEY,
  DEFAULT_TEMPLATES,
  RESULTS_TEMPLATE_KEY,
  buildAlertEmail,
  buildResultsEmail,
  type EmailTemplate,
} from '../email/templates';
import { fetchReportBranding } from '../brand/fetch';
import { reportFileName } from '../pdf/fileName';
import { renderValuationReport } from '../pdf/ValuationReport';
import { DEAL_BAND_UNSURE, DEAL_BANDS_SAR } from '../valuation/data';
import { dealBandLabel, currencyFor, type ValuationResult } from '../valuation/engine';
import { ALERT_TAG, RESULTS_TAG } from '../engagement';
import { insertLeadEvent, setEmailStatusIf, updateLead } from './store';

type LeadForDelivery = Pick<
  ToolLeadRow,
  | 'id'
  | 'tool_slug'
  | 'phone'
  | 'contact_country'
  | 'is_test'
  | 'data_version'
  | 'name'
  | 'email'
  | 'company'
  | 'purpose'
  | 'deal_size_band'
  | 'below_minimum'
  | 'country'
  | 'industry'
  | 'follow_up_consent'
  | 'access_token'
  | 'inputs'
>;

export async function loadToolTemplate(key: string): Promise<EmailTemplate> {
  try {
    const { data } = await createSupabaseServerClient()
      .from('email_templates')
      .select('subject, body_html, enabled')
      .eq('template_key', key)
      .maybeSingle();
    if (data) return data as EmailTemplate;
  } catch {
    // fall through to the shipped default
  }
  return DEFAULT_TEMPLATES[key];
}


function statusFrom(r: SendEmailResult): EmailStatus {
  if (r.ok) return 'sent';
  return r.reason === 'not_configured' ? 'not_configured' : 'failed';
}

export function dealSizeLabel(band: string | null, country: string | null): string {
  if (!band) return 'Not given';
  if (band === DEAL_BAND_UNSURE) return 'Not decided yet';
  const b = DEAL_BANDS_SAR.find((x) => x.value === band);
  return b ? dealBandLabel(b.lo, b.hi, currencyFor(country ?? '')) : band;
}

export async function sendResultsEmail(
  lead: LeadForDelivery,
  result: ValuationResult,
  opts: { resend?: boolean; adminId?: string; source?: 'admin' | 'results' } = {},
): Promise<SendEmailResult> {
  const now = new Date();
  const template = await loadToolTemplate(RESULTS_TEMPLATE_KEY);
  if (!template.enabled) {
    await updateLead(lead.id, { email_status: 'not_configured', email_error: 'Template tool_valuation_results is disabled' });
    await insertLeadEvent({ lead_id: lead.id, event_type: 'email_skipped', source: 'system', email_kind: 'results', detail: 'template disabled' });
    return { ok: false, reason: 'not_configured', message: 'template disabled' };
  }

  const { subject, body } = buildResultsEmail({
    template,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    result,
    bookingHref: await bookingLinkFor(lead, 'email'),
    resumeHref: await resumeLinkForLead(lead),
  });

  // A resend is a new message, so its status starts again. Set before the send,
  // so webhook events for the new message can only move it forward from here.
  if (opts.resend) await updateLead(lead.id, { email_status: 'pending', email_error: null });

  // One company name for the title and the file name: the gate's, else the one typed on step 1.
  const company = lead.company || (lead.inputs as { profile?: { companyName?: string | null } } | null)?.profile?.companyName || null;
  let attachments: { name: string; content: string }[] | undefined;
  try {
    const pdf = await renderValuationReport(result, {
      preparedFor: lead.name,
      company,
      industry: lead.industry ?? '',
      country: lead.country ?? '',
      purpose: lead.purpose,
      generatedAt: now,
      dataVersion: lead.data_version,
      bookingHref: await bookingLinkFor(lead, 'pdf'),
      branding: await fetchReportBranding(),
      description: (lead.inputs as { profile?: { description?: string | null } } | null)?.profile?.description ?? null,
    });
    attachments = [{ name: reportFileName(company, lead.name, now), content: pdf.toString('base64') }];
  } catch (err) {
    // The email still goes, without the report, and the failure is visible.
    console.error('[tool-leads] PDF render failed:', err);
    await insertLeadEvent({
      lead_id: lead.id,
      event_type: 'pdf_failed',
      source: 'system',
      email_kind: 'results',
      detail: err instanceof Error ? err.message.slice(0, 500) : 'render failed',
    });
  }

  const sent = await sendEmail({
    to: lead.email,
    subject,
    html: await baseLayoutBranded(body, { variant: 'report' }),
    from: process.env.EMAIL_FROM_CONTACT || undefined,
    attachments,
    tags: [RESULTS_TAG, lead.tool_slug, 'results', ...(lead.is_test ? ['test'] : [])],
    headers: { 'X-Mailin-custom': `lead:${lead.id}|kind:results` },
  });

  const status = statusFrom(sent);
  // Only from pending: Brevo can report a bounce for this message before this
  // line runs, and `sent` must not overwrite it.
  await setEmailStatusIf(lead.id, { to: status, onlyFrom: ['pending'] }).catch((err) => console.error('[tool-leads]', err));
  await updateLead(lead.id, {
    email_message_id: sent.ok ? sent.id : null,
    email_sent_at: sent.ok ? now.toISOString() : null,
    email_error: sent.ok ? null : (sent.message ?? sent.reason),
  });
  await insertLeadEvent({
    lead_id: lead.id,
    event_type: sent.ok ? (opts.resend ? 'email_resent' : 'email_sent') : status === 'not_configured' ? 'email_not_configured' : 'email_failed',
    source: opts.resend ? (opts.source ?? 'admin') : 'system',
    email_kind: 'results',
    message_id: sent.ok ? sent.id : null,
    detail: sent.ok ? (attachments ? 'with PDF report' : 'without PDF report') : (sent.message ?? sent.reason),
    payload: opts.adminId ? { admin_id: opts.adminId } : null,
  });
  return sent;
}

export async function sendLeadAlert(lead: LeadForDelivery, result: ValuationResult): Promise<SendEmailResult> {
  const settings = await fetchSiteSettings().catch(() => ({ admin_email: undefined }));
  const to = settings.admin_email || process.env.EMAIL_TO_ADMIN || process.env.EMAIL_FROM_DEFAULT;
  if (!to) {
    await updateLead(lead.id, { alert_status: 'not_configured', alert_error: 'No admin email configured' });
    return { ok: false, reason: 'not_configured' };
  }
  const template = await loadToolTemplate(ALERT_TEMPLATE_KEY);
  if (!template.enabled) {
    await updateLead(lead.id, { alert_status: 'not_configured', alert_error: 'Template tool_lead_alert is disabled' });
    return { ok: false, reason: 'not_configured', message: 'template disabled' };
  }
  const { subject, body } = buildAlertEmail({
    template,
    toolName: findTool(lead.tool_slug)?.name ?? lead.tool_slug,
    lead: {
      name: lead.name,
      email: lead.email,
      company: lead.company,
      purpose: lead.purpose,
      dealSizeLabel: dealSizeLabel(lead.deal_size_band, lead.country),
      belowMinimum: lead.below_minimum,
      country: lead.country,
      industry: lead.industry,
      followUp: lead.follow_up_consent,
      isTest: lead.is_test,
      phone: lead.phone ?? null,
      contactCountry: lead.contact_country ?? null,
    },
    result,
    dashboardUrl: `${SITE_HREF}/admin/tool-leads/${lead.id}`,
  });
  const sent = await sendEmail({
    to,
    subject,
    html: await baseLayoutBranded(body, { variant: 'report' }),
    replyTo: lead.email,
    // Its own first tag, so Brevo reporting and the webhook never mix staff
    // opening the alert with the visitor's engagement (src/lib/tools/engagement.ts).
    tags: [ALERT_TAG, lead.tool_slug, 'alert', ...(lead.is_test ? ['test'] : [])],
    headers: { 'X-Mailin-custom': `lead:${lead.id}|kind:alert` },
  });
  await updateLead(lead.id, {
    alert_status: statusFrom(sent),
    alert_message_id: sent.ok ? sent.id : null,
    alert_error: sent.ok ? null : (sent.message ?? sent.reason),
  });
  await insertLeadEvent({
    lead_id: lead.id,
    event_type: sent.ok ? 'alert_sent' : 'alert_failed',
    source: 'system',
    email_kind: 'alert',
    message_id: sent.ok ? sent.id : null,
    detail: sent.ok ? `to ${to}` : (sent.message ?? sent.reason),
  });
  return sent;
}

/** Both emails for a newly saved lead. Never throws. */
export async function deliverNewLead(lead: LeadForDelivery, result: ValuationResult): Promise<void> {
  const results = await Promise.allSettled([sendResultsEmail(lead, result), sendLeadAlert(lead, result)]);
  for (const r of results) if (r.status === 'rejected') console.error('[tool-leads] delivery threw:', r.reason);
}
