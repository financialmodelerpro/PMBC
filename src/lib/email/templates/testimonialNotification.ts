import { baseLayoutBranded, h1, p, button, divider, panel } from './_base';

/**
 * The email Ahmad gets when a client submits a testimonial.
 *
 * Built on the same `baseLayoutBranded` shell and the same helpers as the two
 * contact emails, so it arrives looking like the rest of the firm's mail rather
 * than like a system notice.
 *
 * **It carries the words the client wrote, in full.** The point of the email is
 * to decide whether to approve, and a notification that only says a testimonial
 * arrived would send the reader to the console to find out what it says. What
 * it does not carry is an approve link: approving is a decision made in the
 * moderation queue, behind a login, not from a button in an inbox that could be
 * forwarded or spoofed.
 */
export function testimonialNotificationHtml(args: {
  name: string;
  role: string;
  company: string;
  text: string;
  linkedinUrl: string | null;
  photoUrl: string | null;
  via: string;
  adminUrl: string;
}): Promise<string> {
  const attribution = [args.role, args.company].filter(Boolean).join(', ');

  const rows: string[] = [];
  rows.push(row('From', escapeHtml(args.name)));
  if (attribution) rows.push(row('Role', escapeHtml(attribution)));
  rows.push(row('Arrived via', escapeHtml(args.via)));
  if (args.linkedinUrl) {
    rows.push(
      row(
        'LinkedIn',
        `<a href="${escapeAttr(args.linkedinUrl)}" style="color:#1B3A5F;">${escapeHtml(
          args.linkedinUrl,
        )}</a>`,
      ),
    );
  }
  rows.push(row('Photo', args.photoUrl ? 'Attached, shown in the queue' : 'None'));

  const content = [
    h1('A client has submitted a testimonial'),
    p(
      'It is sitting in the moderation queue as pending. Nothing appears on the site until you approve it.',
    ),
    panel(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows.join(
      '',
    )}</table>`),
    divider(),
    p('<strong>What they wrote</strong>'),
    p(`<em>${escapeHtml(args.text).replace(/\n+/g, '<br />')}</em>`),
    divider(),
    button('Review it in the console', args.adminUrl),
    p(
      'Consent to publish was given on the form. If anything here needs changing before it goes live, edit it in the queue rather than asking them to submit again.',
    ),
  ].join('');

  return baseLayoutBranded(content);
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 0;font-size:13px;color:#6B7280;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:4px 0;font-size:14px;color:#0F1B2D;">${value}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
