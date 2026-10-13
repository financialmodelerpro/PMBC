'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CollectionManager, type ListColumn } from '@/components/admin/CollectionManager';
import { adminPageMain } from '@/lib/admin/styles';

import { CardsPerRowControl } from './CardsPerRowControl';
import { MEMBER_FIELDS } from './fields';

/*
 * The team list. Each member opens on their own screen (/admin/team/<id>),
 * which holds everything about them: the details the card and profile header
 * share, and the profile page's sections. New members start in the drawer with
 * their details; the profile page is created from their screen. Publish and
 * Unpublish on each row flip the member's Published setting without opening
 * them: it hides or shows both their /team card and their profile page.
 */
const COLUMNS: ListColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  {
    key: 'profile_slug',
    label: 'Full profile',
    width: 140,
    render: (r) => (r.profile_slug ? 'Yes' : 'Not yet'),
  },
  {
    key: 'visible',
    label: 'Status',
    badge: true,
    width: 120,
    render: (r) => (r.visible ? 'Published' : 'Draft'),
  },
];

export default function AdminTeamPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Collections"
          title="Team & Advisors"
          description="Everything about each person, in one place: open a member to edit the details their /team card and profile header share, and their full profile page. The founding partner leads /team; use the arrows to order everyone else. While this list is empty /team stays out of the navbar, the footer and the sitemap."
        />
        <CardsPerRowControl />
        <CollectionManager
          apiBase="/api/admin/team"
          fields={MEMBER_FIELDS}
          listColumns={COLUMNS}
          enableReorder
          editHref={(r) => `/admin/team/${r.id}`}
          newDefaults={{ name: '', visible: true, display_order: 0 }}
          itemLabel={(r) => (r.name as string) || 'Team member'}
          statusTone={(r) => (r.visible ? 'success' : 'neutral')}
          quickToggle={{ key: 'visible', onLabel: 'Publish', offLabel: 'Unpublish' }}
          emptyHint="No team members yet. Add the first profile to put /team back in the navbar and footer."
        />
      </div>
    </div>
  );
}
