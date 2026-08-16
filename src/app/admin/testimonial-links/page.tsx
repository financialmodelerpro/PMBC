import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { adminPageMain } from '@/lib/admin/styles';
import { TestimonialLinksManager } from './TestimonialLinksManager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Testimonial Links' };

/**
 * Private links to the testimonial form.
 *
 * Sits next to Testimonials rather than under System: sending a client a link
 * is content work, and the queue that reviews what comes back is already open
 * to editors. Deleting a link is still admin only, like every other delete.
 */
export default function TestimonialLinksPage() {
  return (
    <main style={adminPageMain}>
      <AdminPageHeader
        eyebrow="Collections"
        title="Testimonial Links"
        description="Private links you can send a client so they can leave a testimonial. No expiry: a link works until you revoke it."
      />
      <TestimonialLinksManager />
    </main>
  );
}
