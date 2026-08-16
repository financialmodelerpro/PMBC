import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ChangePasswordForm } from './ChangePasswordForm';
import { adminPageMain } from '@/lib/admin/styles';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Change Password' };

/**
 * Every signed-in user can change their own password, whatever their role.
 *
 * The route acts on the session's own id and never on one from the request, so
 * there is nothing here an editor could point at somebody else's account. Role
 * management lives at `/admin/users`, which is admin only.
 */
export default function ChangePasswordPage() {
  return (
    <main style={adminPageMain}>
      <AdminPageHeader
        eyebrow="System"
        title="Change Password"
        description="Change the password for your own account. You will stay signed in on this device."
      />
      <ChangePasswordForm />
    </main>
  );
}
