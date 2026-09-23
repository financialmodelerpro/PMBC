// scripts/verify-growth-public-guard.mjs
//
// The public site guard (2026-09-23). While the website chat setting is off,
// no public page may contain chat markup, the widget script, or any call to a
// Growth endpoint, and the chat API must answer 404. Checks every page in the
// sitemap and every script those pages load. GET requests only.
//
//   npm run verify-growth-public-guard                     (the live site)
//   VERIFY_BASE=http://localhost:3000 npm run verify-growth-public-guard
//
// Fails if anything appears. If the chat setting is on, the guard does not
// apply and the run says so rather than passing silently.

import { check, finish, publicSiteGuard, serviceClient } from './lib/growthVerify.mjs';

const base = process.env.VERIFY_BASE || 'https://www.pacemakersglobal.com';
console.log(`Public site guard against ${base}`);
const svc = serviceClient();
let off = true;
if (svc) {
  const { data, error } = await svc.from('growth_settings').select('chat_widget_enabled').eq('id', 1).maybeSingle();
  off = Boolean(error) || !data || data.chat_widget_enabled === false;
  check('the website chat setting is off', off, 'switched on: this guard applies only while it is off');
}
if (off) {
  const g = await publicSiteGuard(base);
  console.log(`  ${g.pages} pages and ${g.scripts} scripts checked`);
  check('public pages checked', g.pages >= 10, `only ${g.pages}`);
  check('no chat markup, script or Growth call on any public page or script', g.findings.length === 0, g.findings.slice(0, 10).join('; '));
}
finish('verify-growth-public-guard');
