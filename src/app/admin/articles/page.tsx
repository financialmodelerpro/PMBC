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
  { key: 'excerpt', label: 'Excerpt', type: 'textarea', hint: 'Short summary shown on the index and in previews.' },
  { key: 'cover_url', label: 'Cover image', type: 'media', bucket: 'article-covers' },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'Valuation' },
  { key: 'body', label: 'Body', type: 'richtext' },
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
  { key: 'published_at', label: 'Publish date', type: 'text', hint: 'ISO date. Leave blank to use now on publish.' },
  { key: 'seo_title', label: 'SEO title', type: 'text' },
  { key: 'seo_description', label: 'SEO description', type: 'textarea' },
];

const COLUMNS: ListColumn[] = [
  { key: 'title', label: 'Article' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status', badge: true, width: 120 },
];

export default function AdminArticlesPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Insights"
          description="Thought-leadership articles. Published posts appear on /insights."
        />
        <CollectionManager
          apiBase="/api/admin/articles"
          fields={FIELDS}
          listColumns={COLUMNS}
          newDefaults={{ title: '', status: 'draft', featured: false }}
          itemLabel={(r) => (r.title as string) || 'Article'}
          statusTone={(r) => (r.status === 'published' ? 'success' : 'neutral')}
          emptyHint="No insights yet. Write your first article."
        />
      </div>
    </div>
  );
}
