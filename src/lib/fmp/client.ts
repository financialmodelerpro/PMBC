import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { FmpFetchResult, FmpPagePayload, FmpSlug } from './types';

/**
 * Server-side client for FMP's public page feed.
 *
 * `FMP_API_URL` and `FMP_API_KEY` are read here and nowhere else, and neither
 * is prefixed `NEXT_PUBLIC_`. That prefix is what makes a variable available to
 * the browser, so an unprefixed one cannot reach a client bundle even if this
 * module were imported from a client component: Next would substitute
 * `undefined` rather than the key. The guard below turns that silent
 * substitution into a loud failure, which is the same protection the
 * `server-only` package gives without taking the dependency.
 *
 * CACHING, IN TWO LAYERS
 *
 * 1. Next's ISR cache, via `next: { revalidate }`. This is the normal path and
 *    the one that serves nearly every request.
 *
 * 2. A durable last-known-good copy in the database. ISR alone does not survive
 *    a deploy, a cold region, or a cache eviction, and on any of those a
 *    request that arrives while FMP is down would have nothing to fall back to.
 *    Every successful fetch writes the payload; every failed fetch reads it.
 *
 * The fallback lives in `cms_content` under the `_fmp_cache` section rather
 * than a new table, because adding a table needs DDL that has to be pasted into
 * the Supabase SQL editor by hand, and a fallback cache that only starts
 * working after a manual step is not a fallback. `cms_content` already stores
 * stringified JSON by documented convention. The leading underscore marks it
 * internal, and /admin/content hides sections named that way so an operator is
 * never presented with a page of machine-written JSON to edit.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/fmp/client is server-only. Importing it into a client component would ' +
      'silently read an undefined API key.',
  );
}

const DEFAULT_API_URL = 'https://app.financialmodelerpro.com';
const CACHE_SECTION = '_fmp_cache';

/** ISR window. Matches the `max-age=60` FMP's feed sets on a 200. */
export const FMP_REVALIDATE_SECONDS = 60;

/**
 * Reads `max-age` or `s-maxage` out of a Cache-Control header.
 *
 * Used for the durable cache's freshness, not for the ISR window: `fetch`
 * options are fixed before the response exists, so a header cannot drive the
 * revalidate of the request that returned it. What it can do is let FMP widen
 * or narrow how long PMBC is willing to serve a stored copy, without a deploy
 * on this side.
 */
export function parseMaxAge(header: string | null): number | null {
  if (!header) return null;
  const m = /(?:^|,)\s*s-maxage=(\d+)/i.exec(header) ?? /(?:^|,)\s*max-age=(\d+)/i.exec(header);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function apiBase(): string {
  return (process.env.FMP_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

type CacheRow = { payload: FmpPagePayload; stored_at: string; max_age: number | null };

async function readCache(slug: string): Promise<CacheRow | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('cms_content')
      .select('value')
      .eq('section', CACHE_SECTION)
      .eq('key', slug)
      .maybeSingle();
    if (error || !data?.value) return null;
    const parsed = JSON.parse(data.value) as CacheRow;
    if (!parsed?.payload?.page) return null;
    return parsed;
  } catch {
    // A cache that cannot be read must never be the reason a page fails.
    return null;
  }
}

async function writeCache(slug: string, payload: FmpPagePayload, maxAge: number | null): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const row: CacheRow = { payload, stored_at: new Date().toISOString(), max_age: maxAge };
    const value = JSON.stringify(row);
    // Update first, insert on miss: the same upsert-by-hand pattern the content
    // API uses, and it avoids depending on a unique constraint being present.
    const { error: updateError, count } = await supabase
      .from('cms_content')
      .update({ value, updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('section', CACHE_SECTION)
      .eq('key', slug);
    if (!updateError && (count ?? 0) > 0) return;
    await supabase.from('cms_content').insert({ section: CACHE_SECTION, key: slug, value });
  } catch (e) {
    // Never throw into a page render. A missed cache write costs the fallback,
    // not the request in hand.
    console.warn('[fmp] cache write failed:', (e as Error).message);
  }
}

function ageSeconds(storedAt: string): number | null {
  const t = Date.parse(storedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

/**
 * Fetches one page from FMP, falling back to the stored copy on any failure.
 *
 * Never throws. A page calling this gets a discriminated result and decides
 * what to render, because an exception here would take out the whole route and
 * the entire point is that FMP being down does not take PMBC's pages with it.
 */
export async function fetchFmpPage(slug: FmpSlug): Promise<FmpFetchResult> {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    // Not configured is a distinct outcome from unavailable. A stored copy from
    // a previous deploy is still worth serving, and saying which case it is
    // makes a misconfigured environment obvious rather than looking like an
    // outage.
    const cached = await readCache(slug);
    if (cached) {
      return { ok: true, payload: cached.payload, source: 'cache', ageSeconds: ageSeconds(cached.stored_at) };
    }
    return { ok: false, reason: 'not_configured', detail: 'FMP_API_KEY is not set' };
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/public/pages/${slug}`, {
      headers: { 'x-api-key': key, accept: 'application/json' },
      next: { revalidate: FMP_REVALIDATE_SECONDS, tags: [`fmp:${slug}`] },
    });
  } catch (e) {
    return await fallback(slug, `network error: ${(e as Error).message}`);
  }

  if (!res.ok) {
    // A 404 from FMP means the slug is not opted in over there. That is a real
    // answer rather than an outage, but a stored copy is still preferable to an
    // error page for a URL that has been serving content.
    const detail = `FMP responded ${res.status}`;
    const result = await fallback(slug, detail);
    if (!result.ok && res.status === 404) {
      return { ok: false, reason: 'not_found', detail };
    }
    return result;
  }

  let payload: FmpPagePayload;
  try {
    payload = (await res.json()) as FmpPagePayload;
  } catch {
    return await fallback(slug, 'FMP returned a body that is not JSON');
  }

  if (!payload?.page || !Array.isArray(payload.sections)) {
    return await fallback(slug, 'FMP returned an unexpected shape');
  }

  await writeCache(slug, payload, parseMaxAge(res.headers.get('cache-control')));
  return { ok: true, payload, source: 'live', ageSeconds: 0 };
}

async function fallback(slug: FmpSlug, detail: string): Promise<FmpFetchResult> {
  const cached = await readCache(slug);
  if (cached) {
    console.warn(`[fmp] ${slug}: ${detail}. Serving the stored copy.`);
    return { ok: true, payload: cached.payload, source: 'cache', ageSeconds: ageSeconds(cached.stored_at) };
  }
  console.error(`[fmp] ${slug}: ${detail}. No stored copy available.`);
  return { ok: false, reason: 'unavailable', detail };
}

/**
 * The cache internals, exported so the stored-copy path can be exercised
 * directly rather than by waiting for FMP to go down.
 *
 * **No script currently imports this.** The comment here used to claim the
 * verification script did, which was true of an earlier version of
 * `verify-fmp-subpages` and stopped being true when that script moved to
 * driving the live endpoint with a deliberately wrong key instead. It is kept
 * because the seam is the only way to test a cache read without a real outage,
 * and because `.mjs` scripts cannot import TypeScript, so any future test of it
 * will be a unit test that needs exactly this.
 */
export const __cache = { readCache, writeCache, CACHE_SECTION };
