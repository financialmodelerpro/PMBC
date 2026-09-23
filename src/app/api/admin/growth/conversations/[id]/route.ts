import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { closeConversation } from '@/lib/growth/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.literal('close') });

/** Closes a conversation: the visitor's next message gets the closing reply. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await closeConversation(id);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, 'update', 'growth_conversations', id, { status: 'closed' });
  return NextResponse.json({ conversation: { id: result.value.id, status: result.value.status } });
}
