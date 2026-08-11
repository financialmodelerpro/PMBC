/**
 * FMP's content visibility conventions, reimplemented faithfully.
 *
 * This module is the reason imported pages do not leak content FMP hides. The
 * public feed passes `content` through verbatim, including the flags FMP's own
 * renderer uses to suppress fields, so a consumer that ignores them shows more
 * than the source site does.
 *
 * There are TWO separate conventions, and both are live:
 *
 * 1. SIBLING FIELD FLAGS. `cmsVisible(content, 'x')` in FMP is exactly
 *    `content['x_visible'] !== false`, defaulting to visible. Read from
 *    FMP's `CmsField.tsx`, not guessed. Thirteen fields across FMP's pages
 *    currently carry a false flag, including the training hero's two CTAs and
 *    a button on the Modeling Hub whose label is the untemplated string
 *    "Start {trialDays}-Day Free Trial". That last one is the clearest
 *    illustration of the risk: ignoring the flag would publish a button with
 *    an unresolved placeholder in it on PMBC.
 *
 *    The flag name is NOT always the data key. FMP's hero gates its primary
 *    CTA on `cta1_visible` while the text lives in `cta_primary_text`, so
 *    callers pass the flag name explicitly rather than deriving it.
 *
 * 2. NESTED ITEM FLAGS. Items inside a content array may carry their own
 *    `visible` boolean. FMP's stats items all carry one today and none are
 *    false, so this path is currently latent rather than exercised by live
 *    data. It is implemented anyway: the flag exists in the payload, and a
 *    latent convention that turns on later is exactly the kind of thing that
 *    silently republishes hidden content.
 */

/** FMP's own rule: a field is visible unless its flag is explicitly false. */
export function cmsVisible(
  content: Record<string, unknown> | null | undefined,
  field: string,
): boolean {
  return content?.[`${field}_visible`] !== false;
}

/**
 * Reads a string field, returning '' when the governing flag hides it.
 *
 * `flagField` defaults to the key itself, which is the common case. Pass it
 * explicitly where FMP's flag name and data key differ.
 */
export function visibleString(
  content: Record<string, unknown>,
  key: string,
  flagField: string = key,
): string {
  if (!cmsVisible(content, flagField)) return '';
  const v = content[key];
  return typeof v === 'string' ? v : '';
}

/** First visible non-empty value among several candidate keys, under one flag. */
export function visibleFirst(
  content: Record<string, unknown>,
  keys: string[],
  flagField: string,
): string {
  if (!cmsVisible(content, flagField)) return '';
  for (const k of keys) {
    const v = content[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/**
 * Array items with `visible: false` removed.
 *
 * Absent means visible, matching how every other flag in this file behaves and
 * how FMP treats content authored before a flag existed.
 */
export function visibleItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item) && item.visible !== false,
  );
}

/**
 * Strips hidden fields and hidden nested items from a content blob, recursively.
 *
 * Used as a final pass on anything handed to a PMBC renderer, so a field this
 * module's mapping does not explicitly read cannot slip through hidden. The
 * `_visible` flags themselves are dropped once applied: they are FMP vocabulary
 * and mean nothing to a PMBC renderer.
 */
export function stripHidden(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).visible === false))
      .map((item) => stripHidden(item));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.endsWith('_visible')) continue;
      if (k === 'visible') continue;
      // A field whose flag says hidden is dropped entirely rather than blanked,
      // so a renderer's own "is this set" check does the right thing.
      const base = k;
      if (obj[`${base}_visible`] === false) continue;
      out[k] = stripHidden(v);
    }
    return out;
  }
  return value;
}
