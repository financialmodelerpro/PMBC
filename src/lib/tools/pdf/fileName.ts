/**
 * The valuation report's file name, one rule for every way the PDF leaves the site: the results page
 * download, the results email attachment and the admin download (since 2026-09-21).
 *
 *   With a company:    "Acme Clinics - Indicative Business Valuation - 21 Sep 2026.pdf"
 *   Without one:       "Indicative Business Valuation - Jane Smith - 21 Sep 2026.pdf"
 *
 * Plain module, no PDF imports, so the browser can use it as well as the server.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TITLE = 'Indicative Business Valuation';

/** "21 Sep 2026", in UTC like every other date in the report. */
export function fileDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A name part safe in a file name on any system: no path or reserved characters, no control characters, one space at a time. */
function clean(part: string | null | undefined, max = 80): string {
  return (part ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, max)
    .trim();
}

export function reportFileName(company: string | null | undefined, person: string | null | undefined, date: Date): string {
  const c = clean(company);
  if (c) return `${c} - ${TITLE} - ${fileDate(date)}.pdf`;
  const p = clean(person);
  return p ? `${TITLE} - ${p} - ${fileDate(date)}.pdf` : `${TITLE} - ${fileDate(date)}.pdf`;
}

/**
 * The Content-Disposition header for a download: an ASCII `filename` for older clients and the
 * UTF-8 `filename*` (RFC 6266) so an Arabic or accented company name survives.
 */
export function attachmentHeader(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The file name from a Content-Disposition header, preferring `filename*`. Null when absent. */
export function fileNameFromHeader(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // Fall through to the plain name.
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}
