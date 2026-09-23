import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { keywordChangeSchema } from '@/lib/growth/keywordLibrary';
import { changeKeywordLibrary, getKeywordLibrary } from '@/lib/growth/keywords';

export const dynamic = 'force-dynamic';

/** The keyword library with a signal count per keyword. */
export async function GET(req: Request) {
  const r = await ownerRequest(req);
  if (!r.ok) return r.response;
  return NextResponse.json({ library: await getKeywordLibrary() });
}

/** One change to the library: a toggle, an edit, an addition, a removal or a reset. */
export async function PATCH(req: Request) {
  const r = await ownerRequest(req, keywordChangeSchema);
  if (!r.ok) return r.response;
  const result = await changeKeywordLibrary(r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, r.data.action === 'keyword_remove' ? 'delete' : 'update', 'growth_signal_keywords', 'id' in r.data ? r.data.id : 'group' in r.data ? r.data.group : null, r.data);
  return NextResponse.json({ summary: result.value.summary, library: await getKeywordLibrary() });
}
