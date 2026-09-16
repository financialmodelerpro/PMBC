/**
 * The consent wording on the tool gate, in one place.
 *
 * The form shows it, and the lead API stores the exact text agreed to beside
 * the timestamp, so "what did this person consent to" can be answered from the
 * row itself after the wording changes. Change the text here and every new lead
 * records the new version.
 */

export const CONSENT_TEXT =
  'I agree that PaceMakers may store the details and figures I have entered, and email me my results and report, as described in the privacy policy.';

export const FOLLOW_UP_TEXT =
  'Optional: PaceMakers may follow up by email about my results. We do not share your details.';
