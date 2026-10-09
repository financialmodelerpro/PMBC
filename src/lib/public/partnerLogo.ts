/**
 * Optical size of a partner logo on a Network partners card.
 *
 * Every logo is capped to a maximum height inside a fixed 144 by 56 slot,
 * keeps its aspect ratio and is never enlarged past its natural size. One cap
 * cannot make two logos look the same size, because a wide, solid, coloured
 * mark reads larger than thin line work at the same height. So the cap is set
 * per partner: Standard is the size every card had before this existed, and
 * Smaller is for a logo that reads too heavy beside the others.
 *
 * Stored on the partner as `logo_size`. Absent or unknown means Standard.
 */
export type PartnerLogoSize = 'standard' | 'smaller';

export const PARTNER_LOGO_SIZE_OPTIONS: Array<{ value: PartnerLogoSize; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'smaller', label: 'Smaller' },
];

/** Maximum logo height in pixels. Standard equals the slot height. */
export const PARTNER_LOGO_MAX_HEIGHT: Record<PartnerLogoSize, number> = {
  standard: 56,
  smaller: 44,
};

export function readPartnerLogoSize(value: unknown): PartnerLogoSize {
  return value === 'smaller' ? 'smaller' : 'standard';
}
