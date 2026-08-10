/**
 * The page container, shared by the navbar, the footer and every public section.
 *
 * These existed as three independent literals and had drifted apart, which is
 * why the navbar logo did not line up with the content below it. The navbar and
 * footer were `max-w-[1280px] px-6 lg:px-8` while sections were
 * `max-w-[1200px]` inside a `px-6` wrapper.
 *
 * The two also used different box models, so matching the numbers alone would
 * not have fixed it. Tailwind's preflight sets `box-sizing: border-box`, so a
 * single element carrying both `max-w` and `px` has its padding *inside* the
 * max width, whereas the section pattern puts padding on an outer element and
 * the max width on an inner one, placing padding *outside*. At a 1440px
 * viewport that is a 32px difference in where content starts, and at every
 * viewport the two disagree.
 *
 * Both halves are exported so callers use the same two-element structure:
 *
 *   <outer className={PAGE_GUTTER}>
 *     <inner className={PAGE_INNER}> ... </inner>
 *   </outer>
 *
 * Content then begins at exactly the same x on every surface: the navbar logo,
 * a section eyebrow, a card grid, and the footer brand column all share one
 * left edge. Prefer these over a fresh `max-w-[...]` literal.
 */

/** Horizontal page gutter. Belongs on the OUTER element. */
export const PAGE_GUTTER = 'px-6';

/**
 * Content max width. Belongs on the INNER element, which must not also carry
 * horizontal padding or the border-box arithmetic above reappears.
 *
 * 1200px is the documented content width in CLAUDE.md section 9.
 */
export const PAGE_INNER = 'mx-auto w-full max-w-[1200px]';
