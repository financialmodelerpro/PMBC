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

/**
 * Vertical rhythm for a standard section: 64px mobile, 80px tablet, 96px
 * desktop.
 *
 * 96px at desktop is the figure CLAUDE.md section 9 has always documented. The
 * shipped value had drifted to `lg:py-32` (128px), which is where a good deal
 * of the home page's length came from: eleven sections each carrying 64px more
 * than intended is nearly 700px of pure gap.
 */
export const SECTION_PADDING = 'py-16 sm:py-20 lg:py-24';

/** Tighter rhythm for sections that are a single band rather than a block. */
export const SECTION_PADDING_COMPACT = 'py-12 sm:py-16 lg:py-20';

/**
 * The height every page-leading hero shares.
 *
 * One constant rather than a literal per hero component, because "all the
 * heroes are the same height" is a claim that only survives if there is one
 * place to change. There are three surfaces: the CMS `hero` section, the
 * `PageHeroFallback` used when a page has no hero row, and `founder_hero`,
 * which renders through SectionContainer and so takes this via `size="hero"`.
 *
 * `min-h-[70vh]` sets the height and `py-16` decides what happens when the
 * content is taller than that. The padding is deliberately smaller than a
 * normal section's: for a hero whose content fits, padding is invisible
 * (`items-center` centres it in the 70vh box), so the only thing a larger value
 * does is push the few heroes with more content past the height every other one
 * settles at. At 1440x900 that was /fmp at 727px and /about/ahmad-din at 756px
 * against home's 630px.
 */
export const HERO_MIN_HEIGHT = 'min-h-[70vh]';
export const HERO_PADDING = 'py-16';
export const HERO_FRAME = `relative flex ${HERO_MIN_HEIGHT} items-center ${PAGE_GUTTER} ${HERO_PADDING}`;
