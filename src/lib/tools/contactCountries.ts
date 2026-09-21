/**
 * The countries a person can choose on the name and email step, with each one's international
 * dialling code; choosing one sets the phone field's country (since 2026-09-21). The firm's own markets come
 * first, then the others alphabetically; "Other" leaves the code to be typed. Plain module, shared by
 * the form, the lead API's validation and the admin.
 */
import { COUNTRIES } from '@/lib/public/countries';

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

/** The ISO code the phone picker uses for a country on this list, or '' ("Other", or not found). */
export function isoForContactCountry(country: string): string {
  return COUNTRIES.find((c) => c.name === country)?.code ?? '';
}
