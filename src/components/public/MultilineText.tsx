import { Fragment } from 'react';

/**
 * Space between two paragraphs of one plain text field. Relative to the
 * field's own font size, so a 15px card blurb and an 18px section intro both
 * get a proportionate gap without each call site choosing one.
 */
export const PARAGRAPH_GAP = '0.85em';

/**
 * Splits operator-typed plain text into paragraphs and lines.
 *
 * A blank line (two or more newlines, possibly with spaces between) starts a
 * new paragraph; a single newline is a line break inside one. Windows line
 * endings are normalised first, so `\r\n\r\n` is a blank line too. Empty
 * paragraphs are dropped, so three newlines read the same as two.
 */
export function splitPlainParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => p.split('\n').map((line) => line.trim()));
}

/**
 * Renders a plain textarea value with its paragraph and line breaks kept.
 *
 * Returns inline content to drop inside the element the field already renders
 * in, so the call site keeps its own tag, class and colour. A value with no
 * newline returns the string untouched, which is how every field rendered
 * before this existed: nothing published without a line break changes.
 *
 * Paragraphs are block spans rather than `<p>`, because most call sites
 * already render the field inside a `<p>` and a `<p>` cannot nest.
 */
export function MultilineText({ text }: { text: string }) {
  if (!text.includes('\n') && !text.includes('\r')) return <>{text}</>;
  const paragraphs = splitPlainParagraphs(text);
  return (
    <>
      {paragraphs.map((lines, i) => (
        <span
          key={i}
          className="block"
          style={i === 0 ? undefined : { marginTop: PARAGRAPH_GAP }}
        >
          {lines.map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </span>
      ))}
    </>
  );
}
