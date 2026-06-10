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
  { key: 'role', label: 'Role / title', type: 'text', placeholder: 'Managing Partner' },
  { key: 'photo', label: 'Photo', type: 'media', bucket: 'team-photos' },
  { key: 'credentials', label: 'Credentials', type: 'text', placeholder: 'CFA, MBA' },
  { key: 'bio', label: 'Bio', type: 'richtext' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'visible', label: 'Visible', type: 'checkbox' },
  { key: 'display_order', label: 'Display order', type: 'number' },
];

const COLUMNS: ListColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  {
    key: 'visible',
    label: 'Visible',
    badge: true,
    width: 110,
    render: (r) => (r.visible ? 'Visible' : 'Hidden'),
  },
];

export default function AdminTeamPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Team & Advisors"
          description="People profiles. Visible members render on /team and the about page."
        />
        <CollectionManager
          apiBase="/api/admin/team"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{ name: '', visible: true, display_order: 0 }}
          itemLabel={(r) => (r.name as string) || 'Team member'}
          statusTone={(r) => (r.visible ? 'success' : 'neutral')}
          emptyHint="No team members yet. Add the first profile."
        />
      </div>
    </div>
  );
}
