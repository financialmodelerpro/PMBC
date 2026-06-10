'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  CollectionManager,
  type FieldDef,
  type ListColumn,
} from '@/components/admin/CollectionManager';
import { adminPageMain } from '@/lib/admin/styles';

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'slug', label: 'Slug', type: 'text', hint: 'Auto-generated from the title if left blank.' },
  { key: 'client_name', label: 'Client name', type: 'text', placeholder: 'Confidential' },
  { key: 'industry', label: 'Industry', type: 'text', placeholder: 'Industrial services' },
  { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'cover_image', label: 'Cover image', type: 'media', bucket: 'case-study-images' },
  { key: 'body', label: 'Body', type: 'richtext', hint: 'Challenge, approach, and outcome.' },
  { key: 'metrics', label: 'Headline metrics', type: 'kvList', hint: 'For example: Deal size / SAR 120M.' },
  { key: 'featured', label: 'Featured', type: 'checkbox' },
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
  { key: 'title', label: 'Case study' },
  { key: 'industry', label: 'Industry' },
  { key: 'status', label: 'Status', badge: true, width: 120 },
];

export default function AdminCaseStudiesPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Case Studies"
          description="Engagements and proof of work. Published case studies appear on /case-studies."
        />
        <CollectionManager
          apiBase="/api/admin/case-studies"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{ title: '', status: 'draft', metrics: [], featured: false, display_order: 0 }}
          itemLabel={(r) => (r.title as string) || 'Case study'}
          statusTone={(r) => (r.status === 'published' ? 'success' : 'neutral')}
          emptyHint="No case studies yet. Add your first engagement."
        />
      </div>
    </div>
  );
}
