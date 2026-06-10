'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  CollectionManager,
  type FieldDef,
  type ListColumn,
} from '@/components/admin/CollectionManager';
import { adminPageMain } from '@/lib/admin/styles';

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Financial Modeling' },
  { key: 'slug', label: 'Slug', type: 'text', hint: 'Auto-generated from the title if left blank.' },
  { key: 'number', label: 'Number', type: 'text', placeholder: '01' },
  { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Short one-line summary shown on cards.' },
  { key: 'hero_image', label: 'Hero image', type: 'media', bucket: 'cms-assets' },
  { key: 'body', label: 'Body', type: 'richtext', hint: 'What it is, the process, and deliverables.' },
  { key: 'bullets', label: 'Sub-offerings', type: 'stringList', placeholder: 'Three-statement models' },
  { key: 'cta_text', label: 'CTA text', type: 'text', placeholder: 'Discuss a mandate' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
    ],
  },
  { key: 'display_order', label: 'Display order', type: 'number' },
  { key: 'seo_title', label: 'SEO title', type: 'text' },
  { key: 'seo_description', label: 'SEO description', type: 'textarea' },
];

const COLUMNS: ListColumn[] = [
  { key: 'title', label: 'Service' },
  { key: 'number', label: 'No.', width: 60 },
  { key: 'status', label: 'Status', badge: true, width: 120 },
];

export default function AdminServicesPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Services"
          description="The advisory service lines. Published services appear on /services and their detail pages."
        />
        <CollectionManager
          apiBase="/api/admin/services"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{ title: '', status: 'draft', bullets: [], display_order: 0 }}
          itemLabel={(r) => (r.title as string) || 'Service'}
          statusTone={(r) => (r.status === 'published' ? 'success' : 'neutral')}
          emptyHint="No services yet. Create your first service line."
        />
      </div>
    </div>
  );
}
