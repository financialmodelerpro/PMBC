-- 078_tool_email_templates.sql
-- The two emails a tool lead sends, as editable rows in email_templates.
--
-- SAFE TO APPLY: any time, before or after the free tools code is deployed.
--   Before the deploy nothing reads these keys. After the deploy, until it is
--   applied, the code sends the same wording from its built-in defaults
--   (src/lib/tools/email/templates.ts), so nothing is lost either way.
--
-- DML. Can run in the SQL editor with the others; supabase-js could also apply
-- it, but running it alongside 076 and 077 keeps the order in one place.
--
--   tool_valuation_results  to the visitor, with the PDF report attached.
--   tool_lead_alert         to site_settings.admin_email, one per new lead.
--
-- Variables are listed in src/lib/tools/email/templates.ts. Plain variables
-- are HTML-escaped when rendered. `*_block` variables are markup the server
-- builds (the summary table, the buttons), never text a visitor typed, and are
-- inserted as-is. They are named apart from the existing `*_html` convention,
-- which means "escaped text with line breaks kept".
--
-- Idempotent: inserted only when the key is absent, so an operator's edits at
-- /admin/email-templates are never overwritten.

BEGIN;

INSERT INTO email_templates (template_key, subject, body_html, enabled)
VALUES
  (
    'tool_valuation_results',
    'Your indicative valuation: {{equity_range}}',
    '<p style="margin:0 0 16px;">Dear {{name}},</p>
<p style="margin:0 0 16px;">Thank you for using the PaceMakers business valuation tool. Your indicative results are summarised below, and the full report is attached as a PDF.</p>
{{summary_block}}
<p style="margin:16px 0;">The range blends a discounted cash flow with a comparables check, using Damodaran market data for your industry and country. It is indicative only and is not a valuation opinion.</p>
<p style="margin:0 0 16px;">If you would like to test the assumptions, or discuss what an independent valuation would cover, book a free 30 minute call with our team.</p>
{{booking_button_block}}',
    true
  ),
  (
    'tool_lead_alert',
    'New {{tool_name}} lead: {{name}}{{company_suffix}}{{below_minimum_suffix}}',
    '<p style="margin:0 0 16px;">A new lead has come in from the {{tool_name}} tool.</p>
{{details_block}}
{{dashboard_button_block}}',
    true
  )
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
