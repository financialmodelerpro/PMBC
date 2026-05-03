/**
 * Fetches a font binary from Google Fonts as TTF/OTF (compatible with satori).
 *
 * Google Fonts serves different formats based on User-Agent. By passing an
 * IE-era UA we force the older `truetype` source line in the CSS, which
 * resolves to a TTF binary satori can consume.
 *
 * Cached at module scope — first request per-instance fetches; subsequent
 * requests use the cache. (In a serverless edge environment, "instance"
 * means a single warm worker; cold starts re-fetch.)
 */

const cache = new Map<string, ArrayBuffer>();

const IE_UA =
  'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)';

export async function loadGoogleFont(
  family: string,
  weight: number,
): Promise<ArrayBuffer> {
  const cacheKey = `${family}:${weight}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await fetch(cssUrl, { headers: { 'User-Agent': IE_UA } }).then(
    (r) => r.text(),
  );

  // Google Fonts serves different formats based on User-Agent. With the IE
  // UA above, the response typically contains a single `src: url(...) format('woff')`
  // (or 'truetype'/'opentype' for some families). satori accepts all three —
  // accept whichever format is offered first.
  const match =
    css.match(
      /src:\s*url\(([^)]+)\)\s*format\(['"]?(?:woff|truetype|opentype)['"]?\)/,
    ) ?? css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Could not parse font URL for ${family}:${weight} from Google Fonts CSS`);
  }
  const fontUrl = match[1];
  const data = await fetch(fontUrl).then((r) => r.arrayBuffer());
  cache.set(cacheKey, data);
  return data;
}
