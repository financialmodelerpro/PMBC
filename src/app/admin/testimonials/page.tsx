'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import type { FieldDef } from '@/components/admin/CollectionManager';
import { TestimonialsManager } from '@/components/admin/TestimonialsManager';
import { SubmissionPanel } from './SubmissionPanel';
import { adminPageMain } from '@/lib/admin/styles';

/**
 * Fields for the drawer editor only. Status, Featured and Show on homepage are
 * also here on purpose: the row controls cover the fast path, and an admin who
 * has the drawer open should not have to close it to change them.
 */
const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'text', label: 'Testimonial', type: 'textarea' },
  // Added with migration 072, for the fields a client can now submit. Both are
  // editable here because a submitted LinkedIn URL is typed by hand and a
  // submitted photo is sometimes the wrong crop, and correcting either in the
  // queue is quicker than asking the client to submit again. Blank on every row
  // that predates 072, which renders exactly as it did.
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'text' },
  { key: 'photo_url', label: 'Photo URL', type: 'text' },
  { key: 'rating', label: 'Rating (1 to 5)', type: 'number' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    hint: 'Only approved testimonials render on the public site.',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
    ],
  },
  { key: 'is_featured', label: 'Featured', type: 'checkbox' },
  { key: 'show_on_landing', label: 'Show on homepage', type: 'checkbox' },
  { key: 'display_order', label: 'Display order', type: 'number' },
];

export default function AdminTestimonialsPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Testimonials"
          description="Approve and curate client testimonials. Only approved quotes render on the public pages, and only those flagged for the homepage appear there."
        />
        <SubmissionPanel />
        <TestimonialsManager fields={FIELDS} />
      </div>
    </div>
  );
}
