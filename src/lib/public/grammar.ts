/**
 * "a" or "an" for a phrase that is composed at render time.
 *
 * The rule is about the **sound** the phrase starts with, not the letter, which
 * is why a vowel-letter check is not enough. The service list contains the two
 * cases that break it, in opposite directions:
 *
 *   M&A Advisory    starts with a consonant letter, said "em", so "an M&A"
 *   CFO Advisory    starts with a consonant letter, said "see", so "a CFO"
 *
 * A letter check gets CFO right by accident and M&A wrong. So an initialism is
 * resolved by the spoken name of its first letter, and everything else by its
 * first letter with the usual exceptions.
 *
 * This is deliberately small. It handles the cases the site actually composes
 * plus the well-known traps that would embarrass it later ("a university", "an
 * hour"). It is not a pronunciation dictionary, and a phrase that needs one
 * should be written out by hand rather than generated.
 */

/**
 * Letters whose spoken name begins with a vowel sound.
 *
 * F "eff", H "aitch", L "ell", M "em", N "en", R "ar", S "ess", X "ex", plus
 * the five vowels. This is what makes "an M&A mandate" and "an FDD review"
 * come out right.
 */
const VOWEL_SOUNDING_LETTERS = new Set(['A', 'E', 'F', 'H', 'I', 'L', 'M', 'N', 'O', 'R', 'S', 'X']);

/** Written with a vowel but said with a leading "y" or "w": "a university". */
const CONSONANT_SOUNDING_STARTS = [
  /^uni(?![aeiou])/i, // university, union, unit, unicorn. Not "uninsured".
  /^use/i, // useful, user
  /^usa/i, // usable, usage
  /^uti/i, // utility
  /^eu/i, // European, euro
  /^one/i, // one-off
  /^onc/i, // once
];

/** Written with a consonant but said with a leading vowel: "an hour". */
const VOWEL_SOUNDING_STARTS = [/^hour/i, /^honest/i, /^honou?r/i, /^heir/i];

/**
 * True when the token reads as an initialism rather than a word, so its first
 * letter is spoken by name. Two or more characters, all capitals, allowing the
 * ampersand and full stops that initialisms carry ("M&A", "U.S.").
 */
function isInitialism(token: string): boolean {
  return /^[A-Z][A-Z&.]+$/.test(token) && /[A-Z]/.test(token.slice(1));
}

export function indefiniteArticle(phrase: string): 'a' | 'an' {
  const first = phrase.trim().split(/\s+/)[0] ?? '';
  if (!first) return 'a';

  if (isInitialism(first)) {
    const letter = first.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
    return VOWEL_SOUNDING_LETTERS.has(letter) ? 'an' : 'a';
  }

  if (VOWEL_SOUNDING_STARTS.some((re) => re.test(first))) return 'an';
  if (CONSONANT_SOUNDING_STARTS.some((re) => re.test(first))) return 'a';

  return /^[aeiou]/i.test(first) ? 'an' : 'a';
}

/** "an M&A Advisory" from "M&A Advisory". Casing is left exactly as given. */
export function withIndefiniteArticle(phrase: string): string {
  const trimmed = phrase.trim();
  if (!trimmed) return '';
  return `${indefiniteArticle(trimmed)} ${trimmed}`;
}
