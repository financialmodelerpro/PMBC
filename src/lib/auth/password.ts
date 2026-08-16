/**
 * The one definition of an acceptable password, shared by the change-password
 * screen, the API behind it and the user-creation route.
 *
 * Twelve characters rather than eight. This console can rewrite every page on a
 * site whose whole job is to look credible to family offices, and there is no
 * rate limiting in front of the login. Length is the only property that helps
 * against an offline attempt on a stolen hash, and bcrypt at cost 12 is what
 * makes twelve characters worth something.
 *
 * No character-class rules on purpose. They push people towards `Password1!`
 * and away from a long passphrase, which is the stronger of the two by a wide
 * margin. The rules here are the ones that catch a genuinely bad choice.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * bcrypt truncates at 72 **bytes**, silently. Beyond that, two different
 * passwords sharing a 72-byte prefix verify against the same hash. The ceiling
 * above is well under any real risk of that, and this note is why it exists.
 */
const OBVIOUS = [
  'password',
  'admin',
  'pacemakers',
  'pmbc',
  'letmein',
  'changeme',
  'qwerty',
  '123456',
];

/**
 * Returns a sentence explaining why the password is not acceptable, or null
 * when it is. A sentence rather than a code, because every caller renders it
 * straight to the person who typed it.
 */
export function passwordProblem(password: string): string | null {
  const value = password ?? '';
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase you can remember is stronger than a short password you cannot.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Keep it under ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (value.trim().length === 0) {
    return 'A password of only spaces is not accepted.';
  }
  const lower = value.toLowerCase();
  if (OBVIOUS.some((word) => lower.includes(word))) {
    return 'That contains a word an attacker would try first. Choose something unrelated to the firm or to the word "password".';
  }
  if (/^(.)\1+$/.test(value)) {
    return 'That is one character repeated. Choose something else.';
  }
  return null;
}
