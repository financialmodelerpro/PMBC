import { GrowthSubNav } from '@/components/admin/growth/GrowthSubNav';
import { adminPageMain } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';

export const dynamic = 'force-dynamic';

/**
 * The Growth Engine's section shell: the admin page frame and the Growth
 * sub-navigation around every Growth page. Inside the admin layout, which
 * already checks the session; checked again here and in each page.
 */
export default async function GrowthLayout({ children }: { children: React.ReactNode }) {
  await requireGrowthSession();
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <GrowthSubNav />
        {children}
      </div>
    </div>
  );
}
