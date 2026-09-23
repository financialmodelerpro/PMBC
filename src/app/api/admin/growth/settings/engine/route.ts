import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { getEngineSettings, updateEngineSettings } from '@/lib/growth/engineSettings';
import { ENGINE_GROUPS, engineGroupSchemas, type EngineGroup, type EngineSettings } from '@/lib/growth/engineSettingsModel';

export const dynamic = 'force-dynamic';

const schema = z.object({ group: z.enum(ENGINE_GROUPS as [EngineGroup, ...EngineGroup[]]), values: z.record(z.string(), z.unknown()) });

/** Saves one group of the Phase 2 to 7 settings. The database checks each value again and logs the change. */
export async function PATCH(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const parsed = engineGroupSchemas[r.data.group].safeParse(r.data.values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(422, `${issue?.path?.length ? `${issue.path.join('.')}: ` : ''}${issue?.message ?? 'Validation failed'}`);
  }
  const before = await getEngineSettings();
  const result = await updateEngineSettings(parsed.data as Partial<EngineSettings>, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  const keys = Object.keys(parsed.data) as (keyof EngineSettings)[];
  await auditGrowth(r.adminId, 'update', 'growth_settings', '1', Object.fromEntries(keys.map((k) => [k, result.values[k]])), Object.fromEntries(keys.map((k) => [k, before.values[k]])));
  return NextResponse.json({ values: result.values });
}
