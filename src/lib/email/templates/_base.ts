import { fetchEmailBranding } from '@/lib/cms/emailBranding';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps a fragment of HTML body content in the branded email shell.
 * Header reads logo + primary color from `email_branding`.
 * Footer reads `signature_html` + `footer_html` from `email_branding`.
 */
export async function baseLayoutBranded(content: string): Promise<string> {
  const branding = await safe(fetchEmailBranding(), null);
  const primary = branding?.primary_color || '#1B3A5F';
  const logo = branding?.logo_url || null;
  const signature = branding?.signature_html || '';
  const footer = branding?.footer_html || '';

  const headerInner = logo
    ? `<img src="${escapeHtml(logo)}" alt="PaceMakers" height="36" style="display:block;margin:0 auto;border:0;outline:none;" />`
    : `<h1 style="margin:0;color:#ffffff;font-size:18px;letter-spacing:0.04em;font-family:Georgia,serif;font-weight:600;">PaceMakers Business Consultants</h1>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>PaceMakers Business Consultants</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0F1B2D;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FC;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(15,37,64,0.06);">
            <tr>
              <td style="background:${primary};padding:24px;text-align:center;">${headerInner}</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 24px 36px;font-size:14px;line-height:1.7;color:#0F1B2D;">
                ${content}
                ${signature ? `<div style="margin-top:28px;font-size:13px;color:#374151;">${signature}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #E5E7EB;padding:18px 36px;font-size:11px;color:#6B7280;text-align:center;">
                ${footer || '&copy; PaceMakers Business Consultants LLP'}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
