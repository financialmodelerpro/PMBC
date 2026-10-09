/**
 * Shared settings for operator-authored body copy.
 *
 * The visual rules live in the `.pmbc-prose` block in globals.css. This module
 * holds the two things a renderer needs in TypeScript: the measure, and the
 * alignment contract.
 */

/**
 * Maximum width of a long-form text column.
 *
 * 780px at the 17px body size lands around 70 characters per line, inside the
 * 65 to 75 range that reads comfortably. Section backgrounds and padding are
 * unaffected: only the text column narrows, so the full-width navy and cream
 * rhythm from Phase 9.5 is preserved.
 */
export const PROSE_MEASURE = 780;

export type ProseAlign = 'left' | 'center' | 'right' | 'justify';

const ALIGNMENTS: ProseAlign[] = ['left', 'center', 'right', 'justify'];

export const PROSE_ALIGN_OPTIONS: Array<{ value: ProseAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centered' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justified' },
];

/**
 * Reads an alignment off section content.
 *
 * Defaults to 'left' so every section authored before this field existed keeps
 * rendering exactly as it did. A stored value that is not one of the four is
 * treated as absent rather than trusted, on the same principle as
 * `parseSectionStyles`: content comes from a database an operator can edit.
 */
export function readProseAlign(value: unknown): ProseAlign {
  return ALIGNMENTS.includes(value as ProseAlign) ? (value as ProseAlign) : 'left';
}

/**
 * Justified text at this measure needs hyphenation, otherwise the browser
 * stretches word spacing and opens rivers of whitespace. Only justified copy
 * gets the class, since automatic hyphenation on ragged-right text just adds
 * unnecessary hyphens.
 */
export function proseAlignClass(align: ProseAlign): string {
  return align === 'justify' ? 'pmbc-prose-justify' : '';
}

/**
 * Block alignment for the rich text bodies other than Paragraphs: Text +
 * image, Founder, FMP intro, Prose + checklist and Service detail. Stored as
 * `body_align`, a key of its own so it cannot collide with a layout key those
 * sections already carry.
 *
 * Only Left and Justified, by instruction. Anything else, including the key
 * being absent on every section authored before it existed, reads as Left.
 */
export type BodyAlign = 'left' | 'justify';

export const BODY_ALIGN_OPTIONS: Array<{ value: BodyAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'justify', label: 'Justified' },
];

export function readBodyAlign(value: unknown): BodyAlign {
  return value === 'justify' ? 'justify' : 'left';
}

/**
 * The class and style a body container adds for its alignment. Left adds
 * nothing at all, so a block on Left renders byte for byte as it did before
 * the setting existed. Justified adds the hyphenation class and an inherited
 * text-align, which a paragraph aligned from the toolbar still overrides.
 */
export function bodyAlignAttrs(align: BodyAlign): {
  className: string;
  style: { textAlign?: 'justify' };
} {
  return align === 'justify'
    ? { className: proseAlignClass('justify'), style: { textAlign: 'justify' } }
    : { className: '', style: {} };
}
