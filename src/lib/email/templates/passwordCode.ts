import { baseLayoutBranded, h1, p, divider, panel } from './_base';

/**
 * The six-digit code that confirms a password change.
 *
 * Same branded shell as every other message the firm sends, deliberately: a
 * security email that looks unlike the rest of the mail from a domain is the
 * one people are most likely to mistrust or, worse, to trust when it is a fake.
 *
 * **No link and no button.** The code is typed into a screen the reader already
 * has open. A link in an email that changes a password is the shape of a
 * phishing message, and there is no reason to teach anyone that this account
 * sends one.
 */
export function passwordCodeHtml(args: {
  code: string;
  name: string;
  minutes: number;
}): Promise<string> {
  const content = [
    h1('Confirm your password change'),
    p(
      `${escapeHtml(args.name)}, a password change was requested for your PaceMakers admin account. Enter this code on the screen you started it from:`,
    ),
    panel(
      `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.24em;color:#1B3A5F;text-align:center;padding:6px 0;">${escapeHtml(
        args.code,
      )}</div>`,
    ),
    p(
      `The code expires in ${args.minutes} minutes and can be used once. Your current password keeps working until the change is confirmed.`,
    ),
    divider(),
    p(
      '<strong>If you did not request this</strong>, your password has not changed and nothing further will happen. Whoever asked for it already knew your current password, so change it yourself as soon as you can.',
    ),
  ].join('');

  return baseLayoutBranded(content);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
