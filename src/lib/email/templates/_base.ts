import { fetchEmailBranding } from '@/lib/cms/emailBranding';
import { fetchBranding } from '@/lib/cms/branding';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { BRAND, LEGAL_LINE, NEUTRALS } from '@/lib/brand/letterhead';

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

/**
 * The email header logo in `public/` (the Header Settings white logo file, byte
 * for byte) and the size it is drawn at. Always the `www` host: the apex answers with a redirect, and some
 * email image proxies do not follow one.
 */
export const EMAIL_LOGO = {
  src: 'https://www.pacemakersglobal.com/email/pacemakers-logo-on-navy.png',
  width: 114,
  height: 22,
} as const;

/**
 * The colour logo for the report variant's white header: the Header Settings
 * colour logo file byte for byte (6123x1175), drawn at 115x22 at its own proportions.
 */
export const EMAIL_LOGO_COLOUR = {
  src: 'https://www.pacemakersglobal.com/email/pacemakers-logo.png',
  width: 115,
  height: 22,
} as const;

/**
 * Which shell to draw. `site` is the website's: navy header with the white
 * logo, gold hairline, cream footer, used by the contact, password and
 * testimonial emails. `report` is the tool report's, in the letterhead colours:
 * a white header with the colour logo and the gold tagline, a green and navy
 * accent strip, neutral grounds, and a footer with the legal line and contact
 * details from Site Settings. The tool results email and lead alert use it.
 */
export type EmailVariant = 'site' | 'report';

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
 * The logo is `email_branding.logo_url` when an operator has set one, and
 * otherwise the email-sized PNG in `EMAIL_LOGO`, the white mark on the header
 * navy. The site's own logo files are not used: they are sized for the web and
 * broke in Outlook (see the note at `headerInner`).
 */
export async function baseLayoutBranded(content: string, options: { variant?: EmailVariant } = {}): Promise<string> {
  if (options.variant === 'report') return reportLayout(content);
  const [emailBranding, siteBranding] = await Promise.all([
    safe(fetchEmailBranding(), null),
    safe(fetchBranding(), null),
  ]);

  const accent = emailBranding?.primary_color || NAVY;
  const customLogo = emailBranding?.logo_url || null;
  const brandName = siteBranding?.brand_name || 'PaceMakers Business Consultants';
  const tagline = siteBranding?.tagline || 'Advisory from Structure to Exit';
  const signature = emailBranding?.signature_html || DEFAULT_SIGNATURE;
  const footer = (emailBranding?.footer_html || DEFAULT_FOOTER).replace(
    /\{year\}/g,
    String(new Date().getFullYear()),
  );

  /*
   * The logo is the white logo file from Header Settings, byte for byte
   * (6113x1176), hosted on the site and drawn at 114x22. A reduced copy made
   * for email looked blurry on high density screens, so since 2026-09-17 the
   * original artwork is used and the client scales it down.
   *
   * The tag carries explicit width and height attributes: Outlook desktop
   * ignores `max-height`, and without `width` it drew the file at its native
   * size or not at all, which is what went wrong with this file on 2026-09-16.
   * Every client honours the attributes, and the alt text stands in when images
   * are blocked, which Outlook does by default.
   *
   * `email_branding.logo_url` still wins when an operator sets one. Its size is
   * unknown here, so only the height is fixed: upload an email-sized file.
   */
  const headerInner = customLogo
    ? `<img src="${escapeHtml(customLogo)}" alt="${escapeHtml(brandName)}" height="22" style="display:block;margin:0 auto;border:0;outline:none;height:22px;max-height:22px;" />`
    : `<img src="${EMAIL_LOGO.src}" alt="${escapeHtml(brandName)}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" style="display:block;margin:0 auto;border:0;outline:none;width:${EMAIL_LOGO.width}px;height:${EMAIL_LOGO.height}px;color:#ffffff;font-family:${SERIF};font-size:14px;" />`;

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
 * The report variant. Its signature and footer are fixed here in the letterhead
 * colours; `email_branding` overrides apply to the site shell only, since those
 * stored fragments carry the website palette.
 */
async function reportLayout(content: string): Promise<string> {
  const [siteBranding, settings] = await Promise.all([safe(fetchBranding(), null), safe(fetchSiteSettings(), {} as Awaited<ReturnType<typeof fetchSiteSettings>>)]);
  const R = { ...BRAND, ...NEUTRALS };
  const brandName = siteBranding?.brand_name || 'PaceMakers Business Consultants';
  const tagline = siteBranding?.tagline || 'Advisory from Structure to Exit';
  const email = settings.contact_email_advisory || settings.contact_email || 'advisory@pacemakersglobal.com';
  const site = 'www.pacemakersglobal.com';
  const location = settings.office_location_text || '';
  const year = new Date().getFullYear();
  const logo = `<img src="${EMAIL_LOGO_COLOUR.src}" alt="${escapeHtml(brandName)}" width="${EMAIL_LOGO_COLOUR.width}" height="${EMAIL_LOGO_COLOUR.height}" style="display:block;border:0;outline:none;width:${EMAIL_LOGO_COLOUR.width}px;height:${EMAIL_LOGO_COLOUR.height}px;color:${R.navy};font-family:${SERIF};font-size:14px;" />`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(brandName)}</title>
  </head>
  <body style="margin:0;padding:0;background:${R.shade};font-family:${SANS};font-size:14px;color:${R.text};-webkit-font-smoothing:antialiased;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${R.shade};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${R.border};">

            <!-- Header: colour logo left, gold tagline right, as on the letterhead -->
            <tr>
              <td style="background:#ffffff;padding:22px 32px 18px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" valign="middle">${logo}</td>
                    <td align="right" valign="middle" style="font-family:${SANS};font-size:12px;font-weight:600;color:${R.gold};">${escapeHtml(tagline)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Green accent over the navy rule. Cells, not borders, since Outlook drops thin borders. -->
            <tr>
              <td style="font-size:0;line-height:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="120" bgcolor="${R.green}" style="background:${R.green};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                    <td bgcolor="${R.navy}" style="background:${R.navy};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 32px 26px 32px;font-size:14px;line-height:1.7;color:${R.text};">
                ${content}
                <div style="margin-top:30px;padding-top:18px;border-top:1px solid ${R.border};">
                  <p style="margin:0;font-family:${SERIF};font-size:15px;font-weight:600;color:${R.navy};">${escapeHtml(brandName)}</p>
                  <p style="margin:4px 0 0;font-family:${SANS};font-size:12px;color:${R.grey};">Corporate finance and transaction advisory for family offices, investment offices and corporates across KSA, the GCC and worldwide.</p>
                </div>
              </td>
            </tr>

            <!-- Footer: navy rule, legal line and contact details -->
            <tr><td bgcolor="${R.navy}" style="background:${R.navy};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="background:${R.shade};padding:20px 32px;text-align:left;">
                <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;"><strong style="color:${R.navy};">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:${R.grey};text-decoration:none;">${escapeHtml(email)}</a>
                  &nbsp;&nbsp;<strong style="color:${R.navy};">Web:</strong> <a href="${SITE_URL}" style="color:${R.grey};text-decoration:none;">${site}</a>${location ? `&nbsp;&nbsp;<strong style="color:${R.navy};">Office:</strong> <span style="color:${R.grey};">${escapeHtml(location)}</span>` : ''}</p>
                <p style="margin:0;font-family:${SANS};font-size:11px;color:${R.grey};line-height:1.6;">${escapeHtml(LEGAL_LINE)}<br />&copy; ${year} PaceMakers Business Consultants LLP. All rights reserved.</p>
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
