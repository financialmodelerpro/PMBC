// scripts/lib/productionGuard.mjs
//
// Every script that sends POST, PUT, PATCH or DELETE calls
// refuseWritesAgainstProduction(base) before its first request. Against the
// production domain it prints why and exits with code 2, having sent nothing.
// There is no override flag, by design.
//
// WHY
// On 2026-09-16 the lead API verifier sent its logged-out test submission to
// production after a tool had been switched Live, and created a real lead and
// two emails. A check of state first would not have been enough on its own:
// state can change between the check and the request.
//
// Vercel preview and deployment hosts (*.vercel.app) are refused too, because
// previews read and write the production database.
//
// `npm run verify-production-guard` proves every writing script calls this and
// that each exits 2 without a request when pointed at production.

export const PRODUCTION_DOMAIN = 'pacemakersglobal.com';

export function isProductionUrl(url) {
  if (!url) return false;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === PRODUCTION_DOMAIN || host.endsWith(`.${PRODUCTION_DOMAIN}`) || host.endsWith('.vercel.app');
}

export function refuseWritesAgainstProduction(url, script) {
  if (!isProductionUrl(url)) return;
  console.error(
    `REFUSED ${script}: it sends POST, PUT, PATCH or DELETE requests, and ${url} is production ` +
      '(or a Vercel deployment sharing the production database). Run it against a local build.',
  );
  process.exit(2);
}
