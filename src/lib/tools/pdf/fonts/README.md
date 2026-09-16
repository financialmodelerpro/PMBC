# PDF report fonts

Latin subsets of the site's two typefaces, as WOFF, for `@react-pdf/renderer`,
which cannot read the WOFF2 files `next/font` serves.

| File | Family | Weight |
|------|--------|--------|
| `inter-latin-400-normal.woff` | Inter | 400 |
| `inter-latin-500-normal.woff` | Inter | 500 |
| `inter-latin-600-normal.woff` | Inter | 600 |
| `source-serif-4-latin-400-normal.woff` | Source Serif 4 | 400 |
| `source-serif-4-latin-600-normal.woff` | Source Serif 4 | 600 |

Copied from the `@fontsource/inter` and `@fontsource/source-serif-4` packages
(v5) on 2026-09-16. Both typefaces are licensed under the SIL Open Font License
1.1, which permits embedding and redistribution with software.

They live beside the code rather than in `public/` because a Vercel function
bundle only contains files it is traced to. `next.config.ts` lists this folder
under `outputFileTracingIncludes` for the routes that render a report.
