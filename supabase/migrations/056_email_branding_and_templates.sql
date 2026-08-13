-- 056_email_branding_and_templates.sql
-- The two transactional emails get the firm's presentation.
--
-- WHAT WAS WRONG
-- Both emails were the placeholders migration 008 seeded: a stack of bare
-- <p><strong>Label:</strong> value</p> lines for the admin, and four plain
-- paragraphs for the enquirer. Around them, the shell had nothing to render:
-- `email_branding` was created empty by migration 003 and never filled, so
-- logo_url, signature_html and footer_html were all NULL. The header fell back
-- to a text wordmark and the footer to a single copyright line.
--
-- The result was that the first thing a prospective client received from a firm
-- selling rigour and presentation was an unbranded email. For a credibility
-- document that is not a cosmetic problem.
--
-- WHAT THIS SEEDS
--   1. email_branding.signature_html : the firm signature under the body
--   2. email_branding.footer_html    : contact details plus the registration
--                                      line, in the quiet footer strip
--   3. contact_notification          : the admin alert, rebuilt as a detail
--                                      panel plus the message in full
--   4. contact_acknowledgement       : the enquirer reply, rebuilt with what
--                                      happens next, a booking CTA and the
--                                      confidentiality link
--
-- The shell itself (header band, gold hairline, body, footer strip) is code, in
-- lib/email/templates/_base.ts, following FMP's structure in PMBC's palette.
-- Everything seeded here is also a default in that file, so a fresh database or
-- a cleared row still sends a finished email. The rows exist so an operator can
-- change the wording at /admin/email-branding without a deploy.
--
-- WHAT THIS DELIBERATELY DOES NOT SEED
-- email_branding.logo_url stays NULL. The shell already falls back to
-- branding_config.logo_dark_url, which is the light mark made for dark
-- backgrounds and is exactly what a navy header band needs. Seeding the URL
-- here would copy a storage path that is specific to one Supabase project into
-- a second place, where it would go stale the next time the logo is replaced.
-- Setting an email-specific logo in the admin still overrides it.
--
-- The registration line is the one the founder profile already states, not a
-- new claim: a Limited Liability Partnership under Section 7 of the LLP Act,
-- 2017, registered with SECP.
--
-- DML only, so `npm run seed-email-branding` applies it. The branding rows are
-- written only while they are still empty, so an operator edit is never
-- overwritten. The two templates are replaced outright, which is the intent
-- here: both still held their migration 008 placeholder text.

BEGIN;

-- 1 and 2. Signature and footer ---------------------------------------------
UPDATE email_branding
SET signature_html = '<div style="margin-top:32px;padding-top:20px;border-top:1px solid #E4E7EC;">
  <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-weight:600;color:#1B3A5F;">PaceMakers Business Consultants</p>
  <p style="margin:4px 0 0;font-size:12px;color:#A88530;font-style:italic;">Advisory from Structure to Exit</p>
  <p style="margin:10px 0 0;font-size:13px;color:#52606B;line-height:1.6;">Corporate finance and transaction advisory for family offices, investment offices and corporates across KSA, the GCC and worldwide.</p>
</div>',
    updated_at = NOW()
WHERE id = 1 AND (signature_html IS NULL OR btrim(signature_html) = '');

UPDATE email_branding
SET footer_html = '<p style="margin:0 0 6px;font-size:12px;color:#1B3A5F;font-weight:600;">PaceMakers Business Consultants LLP</p>
<p style="margin:0 0 4px;font-size:12px;color:#52606B;"><a href="mailto:advisory@pacemakersglobal.com" style="color:#52606B;text-decoration:none;">advisory@pacemakersglobal.com</a> &middot; <a href="https://pacemakersglobal.com" style="color:#52606B;text-decoration:none;">pacemakersglobal.com</a></p>
<p style="margin:0 0 10px;font-size:12px;color:#52606B;">Lahore, Pakistan</p>
<p style="margin:0;font-size:11px;color:#8A94A0;line-height:1.6;">Registered as a Limited Liability Partnership under Section 7 of the LLP Act, 2017 (SECP).<br />&copy; {year} PaceMakers Business Consultants LLP. All rights reserved.</p>',
    updated_at = NOW()
WHERE id = 1 AND (footer_html IS NULL OR btrim(footer_html) = '');

-- 3. The admin notification --------------------------------------------------
UPDATE email_templates
SET subject = 'New enquiry: {{name}}{{company_suffix}}',
    body_html = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:23px;font-weight:600;line-height:1.3;color:#1B3A5F;">New enquiry from {{name}}</h1>
<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#52606B;">A message came through the contact form. The reply address on this email is already set to the sender, so replying here answers them directly.</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #E4E7EC;margin:0 0 20px;">
  <tr><td style="background:#FAF7F2;border-bottom:1px solid #E4E7EC;padding:11px 18px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A88530;">Enquirer</td></tr>
  <tr><td style="padding:14px 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;">
      <tr><td width="130" style="padding:5px 0;color:#8A94A0;">Name</td><td style="padding:5px 0;color:#1B3A5F;font-weight:600;">{{name}}</td></tr>
      <tr><td style="padding:5px 0;color:#8A94A0;">Email</td><td style="padding:5px 0;"><a href="mailto:{{email}}" style="color:#1B3A5F;">{{email}}</a></td></tr>
      <tr><td style="padding:5px 0;color:#8A94A0;">Company</td><td style="padding:5px 0;color:#0F1B2D;">{{company}}</td></tr>
      <tr><td style="padding:5px 0;color:#8A94A0;">Phone</td><td style="padding:5px 0;color:#0F1B2D;">{{phone}}</td></tr>
      <tr><td style="padding:5px 0;color:#8A94A0;">Country</td><td style="padding:5px 0;color:#0F1B2D;">{{country}}</td></tr>
      <tr><td style="padding:5px 0;color:#8A94A0;">Service</td><td style="padding:5px 0;color:#0F1B2D;">{{service_interest}}</td></tr>
    </table>
  </td></tr>
</table>

<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A88530;">Message</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF7F2;border-left:3px solid #C69C3E;margin:0 0 20px;">
  <tr><td style="padding:16px 20px;font-size:14px;line-height:1.7;color:#0F1B2D;">{{message_html}}</td></tr>
</table>

<p style="margin:0;font-size:11px;color:#8A94A0;line-height:1.6;">Submitted from {{source_page}}<br />Reference {{submission_id}}</p>',
    updated_at = NOW()
WHERE template_key = 'contact_notification';

-- 4. The enquirer acknowledgement --------------------------------------------
UPDATE email_templates
SET subject = 'We have your message | PaceMakers Business Consultants',
    body_html = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:23px;font-weight:600;line-height:1.3;color:#1B3A5F;">Thank you, {{name}}.</h1>
<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#52606B;">Your message has reached PaceMakers Business Consultants. It goes to the partner rather than into a queue, and you can expect a considered reply within one to two business days.</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#52606B;">If anything about the mandate is time sensitive, reply to this email and it will come straight back to us.</p>

<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A88530;">What you sent</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF7F2;border-left:3px solid #C69C3E;margin:0 0 22px;">
  <tr><td style="padding:16px 20px;font-size:13px;line-height:1.7;color:#0F1B2D;">
    <span style="color:#8A94A0;">Service of interest:</span> {{service_interest}}<br /><br />
    {{message_html}}
  </td></tr>
</table>

<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#52606B;">If a conversation would be quicker than an exchange of emails, you are welcome to put time in the diary directly.</p>
<p style="margin:0 0 22px;"><a href="https://pacemakersglobal.com/book" style="display:inline-block;background:#1B3A5F;color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 30px;border:1px solid #1B3A5F;">Book a meeting</a></p>

<p style="margin:0;font-size:13px;line-height:1.7;color:#8A94A0;">Every enquiry is treated as confidential, whether or not it becomes an engagement. Our <a href="https://pacemakersglobal.com/confidentiality" style="color:#A88530;">confidentiality statement</a> sets out how information shared with us is handled.</p>',
    updated_at = NOW()
WHERE template_key = 'contact_acknowledgement';

COMMIT;
