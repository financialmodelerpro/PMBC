'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  CollectionManager,
  type FieldDef,
  type ListColumn,
} from '@/components/admin/CollectionManager';
import { adminPageMain } from '@/lib/admin/styles';

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'text', label: 'Testimonial', type: 'textarea' },
  { key: 'rating', label: 'Rating (1 to 5)', type: 'number' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
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

const COLUMNS: ListColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status', badge: true, width: 120 },
];

export default function AdminTestimonialsPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Testimonials"
          description="Approve and curate client testimonials. Approved quotes render on the public pages."
        />
        <CollectionManager
          apiBase="/api/admin/testimonials"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{ name: '', text: '', status: 'pending', testimonial_type: 'written', display_order: 0 }}
          itemLabel={(r) => (r.name as string) || 'Testimonial'}
          statusTone={(r) =>
            r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'
          }
          emptyHint="No testimonials yet. Add the first client quote."
        />
      </div>
    </div>
  );
}
