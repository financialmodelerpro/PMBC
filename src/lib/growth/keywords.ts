/**
 * The signal keyword library (2026-09-23). Server only.
 *
 * Until the first change, the library is the defaults in keywordLibrary.ts,
 * shown as they are and never written. The first change (a toggle, an edit, an
 * addition, a removal) saves the defaults to the tables from migration 094 and
 * then applies the change, so the code stays the one source of the defaults.
 * "Reset to defaults" deletes the library and saves the defaults again; the
 * signals keep the keyword text they came from, so counts survive a reset.
 *
 * Before 094 the library is shown read-only and the feed falls back to the
 * old keyword list in Growth Settings.
 */

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb } from './db';
import type { Actor } from './kb';
import { DEFAULT_KEYWORD_GROUPS, KEYWORD_LIMITS } from './keywordLibrary';
import type { TriggerType } from './model';

export type LibraryKeyword = { id: string; keyword: string; trigger: TriggerType; enabled: boolean; isDefault: boolean; count: number };
export type LibraryGroup = { key: string; label: string; region: 'ksa' | 'gcc'; trigger: TriggerType | null; enabled: boolean; keywords: LibraryKeyword[] };
export type KeywordLibrary = {
  /** database: saved rows. defaults: nothing saved yet, the defaults shown. pending: migration 094 is not applied. */
  source: 'database' | 'defaults' | 'pending';
  groups: LibraryGroup[];
  error: string | null;
};

const VIRTUAL = 'd:';
const virtualId = (group: string, index: number) => `${VIRTUAL}${group}:${index}`;
const lower = (s: string) => s.trim().toLowerCase();

type GroupRow = { key: string; label: string; region: 'ksa' | 'gcc'; default_trigger: TriggerType | null; enabled: boolean; sort_order: number };
type KeywordRow = { id: string; group_key: string; keyword: string; trigger_type: TriggerType; enabled: boolean; is_default: boolean; sort_order: number };

function defaultsView(): LibraryGroup[] {
  return DEFAULT_KEYWORD_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    region: g.region,
    trigger: g.trigger,
    enabled: g.enabled,
    keywords: g.keywords.map((k, i) => ({ id: virtualId(g.key, i), keyword: k.keyword, trigger: k.trigger, enabled: true, isDefault: true, count: 0 })),
  }));
}

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '');
}

/**
 * Signals per keyword (real signals only, unless the verifier asks). A signal counts for its keyword by
 * id, or by the keyword text when the keyword was re-created (after a reset).
 */
async function signalCounts(includeTest: boolean): Promise<{ byId: Map<string, number>; byText: Map<string, number> }> {
  const byId = new Map<string, number>();
  const byText = new Map<string, number>();
  let q = growthDb().from('growth_signals').select('matched_keyword_id, matched_keyword').not('matched_keyword', 'is', null);
  if (!includeTest) q = q.eq('is_test', false);
  const { data, error } = await q.limit(20000);
  if (error) return { byId, byText };
  for (const r of (data ?? []) as { matched_keyword_id: string | null; matched_keyword: string | null }[]) {
    if (r.matched_keyword_id) byId.set(r.matched_keyword_id, (byId.get(r.matched_keyword_id) ?? 0) + 1);
    else if (r.matched_keyword) byText.set(lower(r.matched_keyword), (byText.get(lower(r.matched_keyword)) ?? 0) + 1);
  }
  return { byId, byText };
}

/** The library with a signal count per keyword (real signals; the verifier counts its test ones too). Never throws. */
export async function getKeywordLibrary(opts: { includeTestSignals?: boolean } = {}): Promise<KeywordLibrary> {
  try {
    const [g, k] = await Promise.all([
      growthDb().from('growth_keyword_groups').select('*').order('sort_order'),
      growthDb().from('growth_signal_keywords').select('*').order('sort_order').order('created_at'),
    ]);
    if (isMissing(g.error) || isMissing(k.error)) return { source: 'pending', groups: defaultsView(), error: null };
    if (g.error || k.error) return { source: 'pending', groups: defaultsView(), error: (g.error ?? k.error)!.message };
    const groups = (g.data ?? []) as GroupRow[];
    if (!groups.length) return { source: 'defaults', groups: defaultsView(), error: null };
    const counts = await signalCounts(Boolean(opts.includeTestSignals));
    const keywords = (k.data ?? []) as KeywordRow[];
    return {
      source: 'database',
      error: null,
      groups: groups.map((row) => ({
        key: row.key,
        label: row.label,
        region: row.region,
        trigger: row.default_trigger,
        enabled: row.enabled,
        keywords: keywords
          .filter((kw) => kw.group_key === row.key)
          .map((kw) => ({ id: kw.id, keyword: kw.keyword, trigger: kw.trigger_type, enabled: kw.enabled, isDefault: kw.is_default, count: (counts.byId.get(kw.id) ?? 0) + (counts.byText.get(lower(kw.keyword)) ?? 0) })),
      })),
    };
  } catch (err) {
    return { source: 'pending', groups: defaultsView(), error: err instanceof Error ? err.message : 'load failed' };
  }
}

/** The keywords the feed searches: on, in a group that is on. */
export function activeKeywords(lib: KeywordLibrary): (LibraryKeyword & { group: string; region: 'ksa' | 'gcc' })[] {
  return lib.groups.filter((g) => g.enabled).flatMap((g) => g.keywords.filter((k) => k.enabled).map((k) => ({ ...k, group: g.key, region: g.region })));
}

/** Saves the defaults when nothing is saved yet. Safe to call twice: a group already saved is left alone. */
export async function ensureSeeded(actor: Actor | null): Promise<WriteResult<'seeded' | 'already'>> {
  const { count, error } = await growthDb().from('growth_keyword_groups').select('id', { count: 'exact' }).limit(1);
  if (error) return { ok: false, status: isMissing(error) ? 503 : 500, error: isMissing(error) ? 'The keyword library needs 094_growth_signal_keywords.sql applied first.' : error.message };
  if ((count ?? 0) > 0) return { ok: true, value: 'already' };
  return seedDefaults(actor);
}

async function seedDefaults(actor: Actor | null): Promise<WriteResult<'seeded' | 'already'>> {
  const name = actor?.name ?? 'Growth Engine';
  const groupRows = DEFAULT_KEYWORD_GROUPS.map((g, i) => ({ key: g.key, label: g.label, region: g.region, default_trigger: g.trigger, enabled: g.enabled, sort_order: i, updated_by_name: name }));
  const { data: inserted, error } = await growthDb().from('growth_keyword_groups').upsert(groupRows, { onConflict: 'key', ignoreDuplicates: true }).select('key');
  if (error) return { ok: false, status: 500, error: error.message };
  const fresh = new Set(((inserted ?? []) as { key: string }[]).map((r) => r.key));
  if (!fresh.size) return { ok: true, value: 'already' };
  const kwRows = DEFAULT_KEYWORD_GROUPS.filter((g) => fresh.has(g.key)).flatMap((g) => g.keywords.map((k, i) => ({ group_key: g.key, keyword: k.keyword, trigger_type: k.trigger, enabled: true, is_default: true, sort_order: i, created_by_name: name })));
  const { error: kErr } = await growthDb().from('growth_signal_keywords').insert(kwRows);
  if (kErr) return { ok: false, status: 500, error: kErr.message };
  return { ok: true, value: 'seeded' };
}

/** A keyword id from the screen: a saved id, or a default's place in its group before anything was saved. */
async function resolveKeywordId(id: string): Promise<KeywordRow | null> {
  if (id.startsWith(VIRTUAL)) {
    const [group, index] = id.slice(VIRTUAL.length).split(':');
    const def = DEFAULT_KEYWORD_GROUPS.find((g) => g.key === group)?.keywords[Number(index)];
    if (!def) return null;
    const { data } = await growthDb().from('growth_signal_keywords').select('*').eq('group_key', group).ilike('keyword', def.keyword.replace(/[\\%_]/g, (c) => `\\${c}`));
    return ((data ?? []) as KeywordRow[])[0] ?? null;
  }
  const { data } = await growthDb().from('growth_signal_keywords').select('*').eq('id', id).maybeSingle();
  return (data as KeywordRow | null) ?? null;
}

export type KeywordChange =
  | { action: 'group_toggle'; group: string; enabled: boolean }
  | { action: 'keyword_toggle'; id: string; enabled: boolean }
  | { action: 'keyword_edit'; id: string; keyword: string; trigger: TriggerType }
  | { action: 'keyword_add'; group: string; keyword: string; trigger: TriggerType }
  | { action: 'keyword_remove'; id: string }
  | { action: 'reset' };

async function logChange(actor: Actor, summary: string, metadata: Record<string, unknown>, isTest: boolean) {
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'keywords.changed', summary, isTest, metadata });
}

/** Applies one change to the library, saving the defaults first when nothing is saved yet. */
export async function changeKeywordLibrary(c: KeywordChange, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<{ summary: string }>> {
  const isTest = Boolean(opts.isTest);
  const db = growthDb();
  if (c.action === 'reset') {
    const probe = await ensureSeeded(actor);
    if (!probe.ok) return probe;
    const { error: kErr } = await db.from('growth_signal_keywords').delete().not('id', 'is', null);
    if (kErr) return { ok: false, status: 500, error: kErr.message };
    const { error: gErr } = await db.from('growth_keyword_groups').delete().not('key', 'is', null);
    if (gErr) return { ok: false, status: 500, error: gErr.message };
    const seeded = await seedDefaults(actor);
    if (!seeded.ok) return seeded;
    const summary = 'Signal keywords reset to the defaults';
    await logChange(actor, summary, { action: 'reset' }, isTest);
    return { ok: true, value: { summary } };
  }

  const seeded = await ensureSeeded(actor);
  if (!seeded.ok) return seeded;

  if (c.action === 'group_toggle') {
    const { data, error } = await db.from('growth_keyword_groups').update({ enabled: c.enabled, updated_by_name: actor.name }).eq('key', c.group).select('label').maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!data) return { ok: false, status: 404, error: 'That group does not exist' };
    const summary = `Keyword group "${(data as { label: string }).label}" switched ${c.enabled ? 'on' : 'off'}`;
    await logChange(actor, summary, { action: c.action, group: c.group, enabled: c.enabled }, isTest);
    return { ok: true, value: { summary } };
  }

  if (c.action === 'keyword_add') {
    const keyword = c.keyword.trim().replace(/\s+/g, ' ');
    const { data: group } = await db.from('growth_keyword_groups').select('key, label').eq('key', c.group).maybeSingle();
    if (!group) return { ok: false, status: 404, error: 'That group does not exist' };
    const { data: existing } = await db.from('growth_signal_keywords').select('keyword, sort_order').eq('group_key', c.group);
    const rows = (existing ?? []) as { keyword: string; sort_order: number }[];
    if (rows.some((r) => lower(r.keyword) === lower(keyword))) return { ok: false, status: 409, error: 'That keyword is already in this group' };
    if (rows.length >= KEYWORD_LIMITS.perGroup) return { ok: false, status: 422, error: `A group holds at most ${KEYWORD_LIMITS.perGroup} keywords` };
    const sort = rows.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
    const { error } = await db.from('growth_signal_keywords').insert({ group_key: c.group, keyword, trigger_type: c.trigger, enabled: true, is_default: false, sort_order: sort, created_by_name: actor.name });
    if (error) return { ok: false, status: error.code === '23505' ? 409 : 500, error: error.code === '23505' ? 'That keyword is already in this group' : error.message };
    const summary = `Keyword "${keyword}" added to "${(group as { label: string }).label}"`;
    await logChange(actor, summary, { action: c.action, group: c.group, keyword, trigger: c.trigger }, isTest);
    return { ok: true, value: { summary } };
  }

  const row = await resolveKeywordId(c.id);
  if (!row) return { ok: false, status: 404, error: 'That keyword no longer exists' };

  if (c.action === 'keyword_toggle') {
    const { error } = await db.from('growth_signal_keywords').update({ enabled: c.enabled }).eq('id', row.id);
    if (error) return { ok: false, status: 500, error: error.message };
    const summary = `Keyword "${row.keyword}" switched ${c.enabled ? 'on' : 'off'}`;
    await logChange(actor, summary, { action: c.action, id: row.id, enabled: c.enabled }, isTest);
    return { ok: true, value: { summary } };
  }

  if (c.action === 'keyword_edit') {
    const keyword = c.keyword.trim().replace(/\s+/g, ' ');
    const { error } = await db.from('growth_signal_keywords').update({ keyword, trigger_type: c.trigger }).eq('id', row.id);
    if (error) return { ok: false, status: error.code === '23505' ? 409 : 500, error: error.code === '23505' ? 'That keyword is already in this group' : error.message };
    const summary = `Keyword "${row.keyword}" changed to "${keyword}"`;
    await logChange(actor, summary, { action: c.action, id: row.id, from: { keyword: row.keyword, trigger: row.trigger_type }, to: { keyword, trigger: c.trigger } }, isTest);
    return { ok: true, value: { summary } };
  }

  const { error } = await db.from('growth_signal_keywords').delete().eq('id', row.id);
  if (error) return { ok: false, status: 500, error: error.message };
  const summary = `Keyword "${row.keyword}" removed`;
  await logChange(actor, summary, { action: c.action, id: row.id, keyword: row.keyword }, isTest);
  return { ok: true, value: { summary } };
}
