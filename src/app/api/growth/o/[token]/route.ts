import { linkByToken, optOut } from '@/lib/growth/links';

export const dynamic = 'force-dynamic';

/**
 * The opt-out link in every outreach email (Unit 3.2, 2026-09-23).
 *
 * GET shows a one-button confirmation, so a mail scanner that opens links
 * cannot opt someone out by accident; POST does it. A plain page, served by
 * this route alone: no public page, layout or component is involved.
 */

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#0F1B2D"><main style="max-width:520px;margin:64px auto;padding:0 16px"><h1 style="font-family:Georgia,serif;font-weight:600;color:#1B3A5F;font-size:26px">${title}</h1>${body}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
  );

export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const link = await linkByToken(token).catch(() => null);
  if (!link || link.kind !== 'opt_out') return page('Link not recognised', '<p>This link is not valid. If you would like us to stop writing to you, reply to the email and we will remove you.</p>');
  return page(
    'Stop these emails',
    `<p>Confirm below and PaceMakers will not write to this address again.</p><form method="post"><button type="submit" style="background:#1B3A5F;color:#fff;border:0;border-radius:6px;padding:12px 22px;font-size:15px;cursor:pointer">Stop emails to me</button></form>`,
  );
}

export async function POST(_req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const r = await optOut(token).catch(() => ({ ok: false as const, error: 'Something went wrong. Please reply to the email instead and we will remove you.' }));
  if (!r.ok) return page('Not done', `<p>${r.error}</p>`);
  return page('Done', '<p>You will not receive further emails from PaceMakers at this address. Thank you for letting us know.</p>');
}
