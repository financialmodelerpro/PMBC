import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const templateSchema = z.object({
  template_key: z.string().min(1),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  enabled: z.boolean().default(true),
});

const bodySchema = z.object({
  templates: z.array(templateSchema).min(1),
});

async function handleMutation(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const updatedKeys: string[] = [];

  for (const t of parsed.data.templates) {
    const { error } = await supabase
      .from('email_templates')
      .update({
        subject: t.subject,
        body_html: t.body_html,
        enabled: t.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('template_key', t.template_key);
    if (error) {
      return NextResponse.json(
        { error: `Failed to update ${t.template_key}: ${error.message}` },
        { status: 500 },
      );
    }
    updatedKeys.push(t.template_key);
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'email_templates',
    entityId: updatedKeys.join(','),
    metadata: { keys: updatedKeys },
  });

  return NextResponse.json({ ok: true, updated: updatedKeys });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
