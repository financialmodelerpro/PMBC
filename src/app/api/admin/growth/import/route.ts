import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { previewImport, runImport } from '@/lib/growth/import';
import { importRequestSchema, type ImportMapping } from '@/lib/growth/importModel';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Preview or dry run (dryRun true, nothing written), or the import itself. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, importRequestSchema);
  if (!r.ok) return r.response;
  const mapping = r.data.mapping as ImportMapping;
  if (r.data.dryRun) {
    const result = await previewImport(r.data.csv, mapping);
    if (!result.ok) return fail(result.status, result.error);
    return NextResponse.json({ dryRun: true, ...result.value });
  }
  const result = await runImport(r.data.csv, mapping, r.data.filename ?? null, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, 'create', 'growth_imports', result.value.importId, { filename: r.data.filename ?? null, created: result.value.created, errors: result.value.errors.length });
  return NextResponse.json({ dryRun: false, ...result.value });
}
