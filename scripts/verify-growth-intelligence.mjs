// scripts/verify-growth-intelligence.mjs
//
// Proves Phase 7, Intelligence (Units 7.1 to 7.3, migration 093):
//
//   1. Offline, always: the scoring review arithmetic (nothing suggested
//      without enough outcomes, factors that separate outcomes gain weight,
//      moves damped and bounded, always 100), the title and sector groups,
//      that the Daily Brief and Analytics use no AI, migration 093 and gates.
//   2. Read only, against the live database: the Daily Brief and Analytics
//      build without error and every brief item has an action and a reason.
//   3. Only with --write-test-rows, once 093 is applied: a test review is
//      saved pending, rejecting needs a note, approving applies the weights to
//      the test settings row only, and a decided review cannot be decided
//      again. Before 093 this is reported as PENDING.
//
//   npm run verify-growth-intelligence
//   npm run verify-growth-intelligence -- --write-test-rows

import { WRITE, adminOnlyGates, check, dashed, finish, load, markPending, migrationChecks, publicChanges, read, serviceClient, tableReady, walk } from './lib/growthVerify.mjs';

const rv = await load('src/lib/growth/scoring/review.ts');
const an = await load('src/lib/growth/analytics.ts');
const eng = await load('src/lib/growth/engineSettingsModel.ts');

console.log('1. Rules (offline)');
{
  const h = rv.toHundred({ a: 1, b: 1, c: 1 });
  check('weights always round to exactly 100', Object.values(h).reduce((x, y) => x + y, 0) === 100 && Object.values(rv.toHundred({ a: 33.4, b: 33.3, c: 33.3, d: 0.01 })).reduce((x, y) => x + y, 0) === 100);
  const w = { ...eng.DEFAULT_SCORING_WEIGHTS };
  const few = rv.suggestWeights(w, [{ positive: true, shares: {} }, { positive: false, shares: {} }]);
  check(`nothing is suggested below ${rv.MIN_EACH} of each outcome`, !few.ok && few.reason.includes(String(rv.MIN_EACH)));
  const mk = (positive, over) => ({ positive, shares: { geography: 1, sector: 1, project_signal: 0.5, funding_signal: 0.5, scale: 0.5, decision_maker: 0.5, recency: 0.5, ...over } });
  const samples = [...Array.from({ length: 6 }, () => mk(true, { funding_signal: 1, recency: 0.2 })), ...Array.from({ length: 6 }, () => mk(false, { funding_signal: 0, recency: 0.9 }))];
  const s = rv.suggestWeights(w, samples);
  check('a factor that separates wins from losses gains weight', s.ok && s.suggested.funding_signal > w.funding_signal);
  check('a factor that points the wrong way loses weight', s.ok && s.suggested.recency < w.recency);
  check('a factor that does not separate stays close', s.ok && Math.abs(s.suggested.geography - w.geography) <= 2);
  check('suggested weights sum to 100', s.ok && Object.values(s.suggested).reduce((x, y) => x + y, 0) === 100);
  check('moves are bounded', s.ok && s.factors.every((f) => Math.abs(f.suggested - f.current) <= rv.MAX_MOVE + 2));
  check('the suggestion passes the settings validation', s.ok && eng.scoringWeightsSchema.safeParse(s.suggested).success);
  check('title groups', an.titleGroup('Group CFO') === 'Finance head' && an.titleGroup('Managing Director') === 'Chief executive or owner' && an.titleGroup('Head of Investments') === 'Investment or strategy' && an.titleGroup(null) === 'Unknown');
  check('sector groups follow the scoring sectors', an.sectorGroup('Real estate developer') === 'real estate' && an.sectorGroup('') === 'Unknown');
  check('seven breakdown dimensions', an.DIMENSIONS.map((d) => d.value).join(',') === 'source,sector,trigger,title,service,offer,city');
  const brief = read('src/lib/growth/brief.ts');
  const analytics = read('src/lib/growth/analytics.ts');
  check('the Daily Brief and Analytics use no AI', !/runAi|\/ai\//.test(brief) && !/runAi|\/ai\//.test(analytics));
  check('Analytics counts real sends only', analytics.includes("send_mode !== 'mock'"));
  check('every Daily Brief item carries an action and a reason', (brief.match(/items\.push\(\{/g) ?? []).length >= 9 && (brief.match(/action: /g) ?? []).length >= 9 && (brief.match(/reason: /g) ?? []).length >= 9);
  const reviewSrc = read('src/lib/growth/scoringReview.ts');
  check('weights change only on approval', reviewSrc.includes("if (decision === 'approve') {") && (reviewSrc.match(/updateEngineSettings\(/g) ?? []).length === 1);
  const sql = migrationChecks('093_growth_intelligence.sql', ['growth_scoring_reviews']);
  check('093: suggested weights checked to sum to 100', sql.includes('growth_scoring_weights_ok(suggested_weights)') && sql.includes('growth_lead_weights_ok(suggested_weights)'));
  check('093: a rejection needs a note', sql.includes('growth_scoring_reviews_rejection_reason'));
  adminOnlyGates();
  const files = [...walk('src/lib/growth'), ...walk('src/app/admin/growth'), ...walk('src/app/api/admin/growth'), ...walk('src/components/admin/growth'), 'supabase/migrations/093_growth_intelligence.sql', 'scripts/verify-growth-intelligence.mjs'];
  const d = dashed(files);
  check('no em or en dash in any Growth file', d.length === 0, d.join(', '));
  const pub = publicChanges(['src/app/(public)/layout.tsx']);
  check('the public site is untouched apart from the inert chat mount', pub.length === 0, pub.join(', '));
}

console.log('2. Read only: the Daily Brief and Analytics build');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else {
  const briefMod = await load('src/lib/growth/brief.ts');
  const b = await briefMod.dailyBrief();
  check('the Daily Brief builds', typeof b.date === 'string' && Array.isArray(b.items));
  check('every item has a title, an action, a reason and a link', b.items.every((i) => i.title && i.action && i.reason && i.href.startsWith('/admin/growth')));
  const a = await an.analytics('90');
  check('Analytics builds with every breakdown', Object.keys(a.breakdowns).length === 7 && typeof a.totals.aiCostUsd === 'number');
  check('the funnel never narrows the wrong way', a.funnel.leads >= a.funnel.replied && a.funnel.replied >= a.funnel.proposals && a.funnel.proposals >= a.funnel.won);

  console.log('3. Live database, test rows');
  if (!(await tableReady(svc, 'growth_scoring_reviews'))) markPending('saving, rejecting and approving a scoring review', '093_growth_intelligence.sql');
  else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
  else await live(svc);
}

async function live(svc) {
  const review = await load('src/lib/growth/scoringReview.ts');
  const settings = await load('src/lib/growth/settings.ts');
  const actor = { id: 'verify-growth-intelligence', name: 'Intelligence verifier' };
  const started = new Date(Date.now() - 1000).toISOString();
  const { data: realBefore } = await svc.from('growth_settings').select('scoring_weights').eq('id', 1).single();
  const { data: testRow } = await svc.from('growth_settings').select('id').eq('id', settings.TEST_SETTINGS_ROW).maybeSingle();
  if (!testRow) await svc.from('growth_settings').insert({ id: settings.TEST_SETTINGS_ROW, is_test: true });
  const suggested = { geography: 12, sector: 15, project_signal: 18, funding_signal: 25, scale: 12, decision_maker: 10, recency: 8 };
  const ids = [];
  try {
    const mk = async () => {
      const { data } = await svc.from('growth_scoring_reviews').insert({ is_test: true, kind: 'prospect', sample_size: 12, positives: 6, negatives: 6, current_weights: realBefore.scoring_weights, suggested_weights: suggested, analysis: {} }).select('id').single();
      ids.push(data.id);
      return data.id;
    };
    const { error: bad } = await svc.from('growth_scoring_reviews').insert({ is_test: true, kind: 'prospect', sample_size: 1, positives: 1, negatives: 0, current_weights: {}, suggested_weights: { ...suggested, recency: 50 }, analysis: {} });
    check('the database refuses suggested weights that do not sum to 100', bad?.code === '23514');
    const a = await mk();
    const noNote = await review.decideReview(a, 'reject', null, actor);
    check('rejecting needs a note', !noNote.ok && noNote.status === 422);
    const rej = await review.decideReview(a, 'reject', 'Too few outcomes to trust', actor);
    check('a review is rejected with its note and the weights unchanged', rej.ok && rej.value.status === 'rejected');
    const again = await review.decideReview(a, 'approve', null, actor);
    check('a decided review cannot be decided again', !again.ok && again.status === 409);
    const b = await mk();
    const ok = await review.decideReview(b, 'approve', null, actor);
    const { data: testAfter } = await svc.from('growth_settings').select('scoring_weights').eq('id', settings.TEST_SETTINGS_ROW).single();
    const { data: realAfter } = await svc.from('growth_settings').select('scoring_weights').eq('id', 1).single();
    // The database returns JSONB with its keys sorted, so compare key by key.
    const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);
    check('approving a test review applies its weights to the test row only', ok.ok && same(testAfter.scoring_weights, suggested) && same(realAfter.scoring_weights, realBefore.scoring_weights), ok.ok ? JSON.stringify(testAfter.scoring_weights) : ok.error);
  } finally {
    if (ids.length) await svc.from('growth_scoring_reviews').delete().eq('is_test', true).in('id', ids);
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started);
    if (!testRow) await svc.from('growth_settings').delete().eq('id', settings.TEST_SETTINGS_ROW).eq('is_test', true);
    else await svc.from('growth_settings').update({ scoring_weights: eng.DEFAULT_SCORING_WEIGHTS }).eq('id', settings.TEST_SETTINGS_ROW).eq('is_test', true);
    const { count } = await svc.from('growth_scoring_reviews').select('id', { count: 'exact', head: true }).eq('is_test', true);
    check('every test review removed', count === 0);
  }
}

finish('verify-growth-intelligence');
