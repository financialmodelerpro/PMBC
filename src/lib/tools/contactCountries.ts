/**
 * The countries a person can choose on the name and email step, with each one's international
 * dialling code, which fills the phone number's code (since 2026-09-21). The firm's own markets come
 * first, then the others alphabetically; "Other" leaves the code to be typed. Plain module, shared by
 * the form, the lead API's validation and the admin.
 */
export type ContactCountry = { name: string; dial: string };

export const CONTACT_COUNTRIES: ContactCountry[] = [
  { name: 'Saudi Arabia', dial: '+966' },
  { name: 'United Arab Emirates', dial: '+971' },
  { name: 'Qatar', dial: '+974' },
  { name: 'Kuwait', dial: '+965' },
  { name: 'Oman', dial: '+968' },
  { name: 'Bahrain', dial: '+973' },
  { name: 'Pakistan', dial: '+92' },
  { name: 'Algeria', dial: '+213' },
  { name: 'Australia', dial: '+61' },
  { name: 'Bangladesh', dial: '+880' },
  { name: 'Canada', dial: '+1' },
  { name: 'China', dial: '+86' },
  { name: 'Egypt', dial: '+20' },
  { name: 'France', dial: '+33' },
  { name: 'Germany', dial: '+49' },
  { name: 'Hong Kong', dial: '+852' },
  { name: 'India', dial: '+91' },
  { name: 'Indonesia', dial: '+62' },
  { name: 'Iraq', dial: '+964' },
  { name: 'Ireland', dial: '+353' },
  { name: 'Italy', dial: '+39' },
  { name: 'Japan', dial: '+81' },
  { name: 'Jordan', dial: '+962' },
  { name: 'Kenya', dial: '+254' },
  { name: 'Lebanon', dial: '+961' },
  { name: 'Malaysia', dial: '+60' },
  { name: 'Morocco', dial: '+212' },
  { name: 'Netherlands', dial: '+31' },
  { name: 'Nigeria', dial: '+234' },
  { name: 'Singapore', dial: '+65' },
  { name: 'South Africa', dial: '+27' },
  { name: 'Spain', dial: '+34' },
  { name: 'Sri Lanka', dial: '+94' },
  { name: 'Switzerland', dial: '+41' },
  { name: 'Tunisia', dial: '+216' },
  { name: 'Turkey', dial: '+90' },
  { name: 'United Kingdom', dial: '+44' },
  { name: 'United States', dial: '+1' },
  { name: 'Other', dial: '' },
];

export function dialCodeFor(country: string): string {
  return CONTACT_COUNTRIES.find((c) => c.name === country)?.dial ?? '';
}

export function isContactCountry(country: string): boolean {
  return CONTACT_COUNTRIES.some((c) => c.name === country);
}

/**
 * A phone number as stored: the code and the number, spaces kept, anything else dropped. Null when
 * blank. The number must then carry 6 to 15 digits (E.164 allows at most 15), or it is refused.
 */
export function cleanPhone(code: string, number: string): string | null {
  const c = (code || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const nRaw = (number || '').replace(/[^\d ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!nRaw) return null;
  const withPlus = c ? (c.startsWith('+') ? c : `+${c}`) : '';
  return `${withPlus} ${nRaw}`.trim();
}

export function phoneDigitCount(phone: string): number {
  return phone.replace(/\D/g, '').length;
}

export const PHONE_MESSAGE = 'Enter a phone number with 6 to 15 digits, or leave it blank.';
