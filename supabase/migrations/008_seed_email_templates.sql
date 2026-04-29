-- 008_seed_email_templates.sql
-- Two transactional templates: contact_notification (admin) and
-- contact_acknowledgement (the person who submitted the form).
-- Variables use {{name}} style placeholders that lib/email/send.ts will
-- substitute at send time.

INSERT INTO email_templates (template_key, subject, body_html, enabled) VALUES
  (
    'contact_notification',
    'New contact submission — {{name}}',
    '<h2>New contact submission</h2>
<p><strong>Name:</strong> {{name}}</p>
<p><strong>Email:</strong> {{email}}</p>
<p><strong>Company:</strong> {{company}}</p>
<p><strong>Phone:</strong> {{phone}}</p>
<p><strong>Country:</strong> {{country}}</p>
<p><strong>Service interest:</strong> {{service_interest}}</p>
<p><strong>Source page:</strong> {{source_page}}</p>
<hr />
<p><strong>Message</strong></p>
<p>{{message}}</p>
<hr />
<p><small>Submission ID: {{submission_id}}</small></p>',
    true
  ),
  (
    'contact_acknowledgement',
    'Thank you for reaching out — PaceMakers Business Consultants',
    '<p>Dear {{name}},</p>
<p>Thank you for getting in touch with PaceMakers Business Consultants. We have received your message and one of our team will respond within one to two business days.</p>
<p>In the meantime, if your enquiry is time-sensitive, please reply to this email or contact us directly via the details on our website.</p>
<p>Kind regards,<br />PaceMakers Business Consultants</p>',
    true
  )
ON CONFLICT (template_key) DO NOTHING;
