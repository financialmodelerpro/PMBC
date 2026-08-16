import { redirect } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { getOwnerSession } from '@/lib/auth/requireAdmin';
import { adminPageMain } from '@/lib/admin/styles';
import { UsersManager } from './UsersManager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Users' };

/**
 * Admin only, checked here as well as in the middleware and in the API.
 *
 * Three gates for one screen is deliberate: the middleware can be reconfigured,
 * the layout guard is a server-side backstop for that, and the API is the one
 * that actually matters because it is what a request reaches when there is no
 * screen involved at all.
 */
export default async function UsersPage() {
  const session = await getOwnerSession();
  if (!session) redirect('/admin');

  return (
    <main style={adminPageMain}>
      <AdminPageHeader
        eyebrow="System"
        title="Users"
        description="Who can sign in to this console, and what each of them may do."
      />
      <UsersManager currentUserId={session.user.id} />
    </main>
  );
}
