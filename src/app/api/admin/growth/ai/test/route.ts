import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { runAi } from '@/lib/growth/ai/run';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * One test call through the AI layer, from Growth Settings. Runs against the
 * real settings (so an empty budget refuses it, as it would an agent), is
 * recorded as a test call, and never needs the Knowledge Base. In mock mode it
 * costs nothing.
 */
export async function POST() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const result = await runAi({
    agent: 'settings-test-call',
    purpose: 'test',
    messages: [{ role: 'user', content: 'Reply with one short sentence confirming the Growth Engine AI layer is working.' }],
    maxTokens: 200,
    requireKnowledge: false,
    isTest: true,
  });
  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'ai_test_call',
    entityType: 'growth_ai_usage',
    entityId: result.usageId,
    afterValue: { ok: result.ok, mock: result.mock, reason: result.ok ? null : result.reason },
  });
  return NextResponse.json(result);
}
