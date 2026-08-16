import { fetchEmailBranding } from '@/lib/cms/emailBranding';
import { fetchBranding } from '@/lib/cms/branding';

/**
 * The branded email shell.
 *
 * Structure follows FMP's `_base.ts` (navy header band, white body, quiet
 * footer strip, table-based throughout with inline styles) because that
 * structure is what survives Outlook, and it is the house standard across both
 * properties. The palette is PMBC's: navy #1B3A5F, cream #FAF7F2, gold #C69C3E,
 * with a serif brand voice rather than FMP's blue and sans.
 *
 * Everything visible here has a shipped default. `email_branding` overrides the
 * logo, the accent, the signature and the footer, so an operator can change any
 * of them at /admin/email-branding, but a NULL row renders a finished email
 * rather than a bare one. That was the actual fault: the row was created empty
 * by migration 003 and never filled, so the header fell back to a text
 * wordmark and the footer rendered a single copyright line.
 */

const NAVY = '#1B3A5F';
const NAVY_DEEP = '#14304F';
const GOLD = '#C69C3E';
const GOLD_MUTED = '#A88530';
const CREAM = '#FAF7F2';
const TEXT = '#0F1B2D';
const MUTED = '#52606B';
const BORDER = '#E4E7EC';

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pacemakersglobal.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shipped signature. Overridden by `email_branding.signature_html`.
 *
 * Kept in code as well as seeded into the database on purpose: a fresh Supabase
 * project, or a row an operator clears by accident, must still send a signed
 * email rather than one that stops mid-sentence.
 */
const DEFAULT_SIGNATURE = `
<div style="margin-top:32px;padding-top:20px;border-top:1px solid ${BORDER};">
  <p style="margin:0;font-family:${SERIF};font-size:15px;font-weight:600;color:${NAVY};">PaceMakers Business Consultants</p>
  <p style="margin:4px 0 0;font-family:${SANS};font-size:12px;color:${GOLD_MUTED};font-style:italic;">Advisory from Structure to Exit</p>
  <p style="margin:10px 0 0;font-family:${SANS};font-size:13px;color:${MUTED};line-height:1.6;">
    Corporate finance and transaction advisory for family offices, investment offices and corporates across KSA, the GCC and worldwide.
  </p>
</div>`.trim();

/** Shipped footer. Overridden by `email_branding.footer_html`. */
const DEFAULT_FOOTER = `
<p style="margin:0 0 6px;font-family:${SANS};font-size:12px;color:${NAVY};font-weight:600;">PaceMakers Business Consultants LLP</p>
<p style="margin:0 0 4px;font-family:${SANS};font-size:12px;color:${MUTED};">
  <a href="mailto:advisory@pacemakersglobal.com" style="color:${MUTED};text-decoration:none;">advisory@pacemakersglobal.com</a>
  &nbsp;&middot;&nbsp;
  <a href="${SITE_URL}" style="color:${MUTED};text-decoration:none;">pacemakersglobal.com</a>
</p>
<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;color:${MUTED};">Lahore, Pakistan</p>
<p style="margin:0;font-family:${SANS};font-size:11px;color:#8A94A0;line-height:1.6;">
  Registered as a Limited Liability Partnership under Section 7 of the LLP Act, 2017 (SECP).<br />
  &copy; {year} PaceMakers Business Consultants LLP. All rights reserved.
</p>`.trim();

/**
 * Wraps a fragment of body HTML in the shell.
 *
 * The logo resolves through three sources, in this order: the email-specific
 * one, then the site's dark-background logo, then a serif wordmark. The middle
 * step matters because the header band is navy, and `branding_config.logo_url`
 * is the light-background mark: using it here would put a navy logo on navy.
 * `logo_dark_url` is the version made for exactly this situation and it is
 * already uploaded, so the email carries the real mark without anyone having to
 * upload it a second time.
 */
export async function baseLayoutBranded(content: string): Promise<string> {
  const [emailBranding, siteBranding] = await Promise.all([
    safe(fetchEmailBranding(), null),
    safe(fetchBranding(), null),
  ]);

  const accent = emailBranding?.primary_color || NAVY;
  const logo = emailBranding?.logo_url || siteBranding?.logo_dark_url || null;
  const brandName = siteBranding?.brand_name || 'PaceMakers Business Consultants';
  const tagline = siteBranding?.tagline || 'Advisory from Structure to Exit';
  const signature = emailBranding?.signature_html || DEFAULT_SIGNATURE;
  const footer = (emailBranding?.footer_html || DEFAULT_FOOTER).replace(
    /\{year\}/g,
    String(new Date().getFullYear()),
  );

  /*
   * 22px rather than 42px.
   *
   * The brand logo files carried transparent margins until migration 060, and
   * were only 52.5% ink vertically, so a 42px box drew a 22px mark. Now that
   * the files are trimmed the box is the mark, and 22px keeps the header band
   * looking exactly as it does today. Both the attribute and the max-height
   * move together: Outlook honours the attribute and ignores much of the style,
   * so leaving one at 42 would render the logo at twice the intended size in
   * the client least able to cope with it.
   */
  const headerInner = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brandName)}" height="22" style="display:block;margin:0 auto;border:0;outline:none;max-height:22px;" />`
    : `<div style="font-family:${SERIF};font-size:20px;font-weight:600;color:#ffffff;letter-spacing:0.01em;">${escapeHtml(brandName)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(brandName)}</title>
  </head>
  <body style="margin:0;padding:0;background:${CREAM};font-family:${SANS};font-size:14px;color:${TEXT};-webkit-font-smoothing:antialiased;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREAM};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};">

            <!-- Header -->
            <tr>
              <td style="background:${accent};padding:26px 36px;text-align:center;">
                ${headerInner}
                <div style="margin-top:10px;font-family:${SERIF};font-style:italic;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};">
                  ${escapeHtml(tagline)}
                </div>
              </td>
            </tr>
            <!-- The gold hairline the site uses under every navy band. Its own
                 row rather than a border, since Outlook drops thin borders. -->
            <tr><td style="background:${GOLD};font-size:0;line-height:0;height:3px;">&nbsp;</td></tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 36px 28px 36px;font-size:14px;line-height:1.7;color:${TEXT};">
                ${content}
                ${signature}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:${CREAM};border-top:1px solid ${BORDER};padding:22px 36px;text-align:center;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Body-content helpers, matching the set FMP's `_base.ts` exports.
 *
 * The two shipped templates keep their markup in `email_templates.body_html`
 * so an operator can edit them, so these are not used by the contact emails.
 * They exist for templates written in code later, and so a third email does not
 * have to reinvent the type scale by hand.
 */
export function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:23px;font-weight:600;line-height:1.3;color:${NAVY};">${text}</h1>`;
}

export function p(text: string, style = ''): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${MUTED};${style}">${text}</p>`;
}

export function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${NAVY};color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 30px;border:1px solid ${NAVY};">${label}</a>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;" />`;
}

/** The navy-on-cream detail panel the admin notification uses. */
export function panel(inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREAM};border-left:3px solid ${GOLD};margin:18px 0;">
  <tr><td style="padding:16px 20px;">${inner}</td></tr>
</table>`;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
