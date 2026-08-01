/**
 * One-off rewiring for the copied CMS.
 *
 * Rewrites IMPORT LINES ONLY. It never touches authorisation logic: the session
 * shim presents the same shape NextAuth did, so every `session?.user?.role`
 * check in the copied routes keeps working exactly as it did in the original.
 *
 * Also drops the two FMP-specific pieces that have no meaning on a consultancy
 * site: the newsletter auto-notify on publish, and the Announce button, both of
 * which assume a student and subscriber list.
 *
 * Safe to re-run: every replacement is idempotent.
 *
 *   node scripts/rewire-imports.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'scripts') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

// NOTE ON \r?\n: these files carry CRLF line endings. An earlier version of
// this script ended its import patterns with a bare \n, so every one of them
// silently matched nothing while the patterns without a newline worked. If a
// replacement here ever appears to do nothing, check the line ending first.
const EDITS = [
  // NextAuth -> the local shims. Import lines only, never auth logic.
  [/import \{ getServerSession \} from 'next-auth';/g,
   "import { getServerSession } from '@/src/shared/auth/session';"],
  [/import \{ authOptions \} from '@\/src\/shared\/auth\/nextauth';/g,
   "import { authOptions } from '@/src/shared/auth/session';"],
  [/from 'next-auth\/react';/g, "from '@/src/shared/auth/clientSession';"],

  // Newsletter auto-notify on publish: no subscriber list on this site.
  [/import \{ sendAutoNewsletter \} from '@\/src\/shared\/newsletter\/autoNotify';\r?\n/g, ''],
  [/^[ \t]*(?:void |await )?sendAutoNewsletter\([\s\S]*?\);[ \t]*\r?$/gm,
   '    // Newsletter auto-notify removed: this site has no subscriber list.'],

  // Announce button: same reason.
  [/import \{ AnnounceArticleButton \} from '@\/src\/components\/admin\/AnnounceArticleButton';\r?\n/g, ''],
  [/[ \t]*<AnnounceArticleButton[^>]*\/>\r?\n?/g, ''],
];

let changed = 0;
for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'src')))) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const [from, to] of EDITS) after = after.replace(from, to);
  if (after !== before) { writeFileSync(file, after); changed++; }
}
console.log(`rewired ${changed} files`);
