'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  CollectionManager,
  type FieldDef,
  type ListColumn,
} from '@/components/admin/CollectionManager';
import { adminPageMain } from '@/lib/admin/styles';

/*
 * Exactly what a team card renders, and nothing else.
 *
 * Two column names read differently here than in the database, because the card
 * is what an operator is filling in:
 *   credentials -> Qualification    the letters after the name
 *   bio         -> Short bio        the founding partner's card only
 *
 * Every other member's card is the same small standard card: qualification,
 * years of experience, location and up to three Selected experience lines,
 * with everything else on their profile page. `profile_type` and
 * `expertise_items` (migration 101) stay on the table but are no longer
 * edited here, since no card renders them any more.
 *
 * `linkedin_url` and `email` are deliberately absent. Both columns still exist
 * on `team_members` (migration 023) and an applied migration is never edited, but
 * neither is rendered on /team and an admin field that writes to nothing is
 * worse than no field: it invites an operator to enter a working email and
 * assume it is published somewhere.
 */
const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text', placeholder: 'Founding Partner' },
  {
    key: 'credentials',
    label: 'Qualification',
    type: 'text',
    placeholder: 'ACMA (ICMAP)',
    hint: 'The professional qualification, kept short. Shown on the card; leave empty if there is none.',
  },
  {
    key: 'experience_years',
    label: 'Experience',
    type: 'text',
    placeholder: '12+ years',
    hint: 'Years of experience, as it should read on the card. Needs migration 108.',
  },
  {
    key: 'location',
    label: 'Location',
    type: 'text',
    placeholder: 'Riyadh, KSA',
    hint: 'Where the member is based. Needs migration 108.',
  },
  {
    key: 'bio',
    label: 'Short bio',
    type: 'richtext',
    hint: 'Shown on the founding partner’s card only. Every other member’s background belongs on their profile page, edited in the page builder.',
  },
  {
    key: 'experience_items',
    label: 'Selected experience',
    type: 'stringList',
    placeholder: 'Co-led advisory on an acquisition in the fertilizer sector',
    hint: 'The card’s key highlights: the first three lines show, so keep each to one short sentence. The full list belongs on the profile page.',
  },
  {
    key: 'photo',
    label: 'Photo',
    type: 'media',
    bucket: 'team-photos',
    hint: 'A portrait photo, ideally 4:5. Export it with square corners and no border, coloured line or edge: the site draws the frame, and anything baked into the image shows inside it. Leave empty to show the initials.',
  },
  {
    key: 'display_order',
    label: 'Display order',
    type: 'number',
    hint: 'Low numbers first. The founding partner leads the page regardless of this.',
  },
  {
    key: 'visible',
    label: 'Published',
    type: 'checkbox',
    hint: 'Unpublished members are kept but do not render. While no member is published, /team is withheld from the navbar, the footer and the sitemap.',
  },
];

const COLUMNS: ListColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
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
          title="Team"
          description="People profiles. Published members render on /team, the founding partner first. While this list is empty the page stays out of the navbar, the footer and the sitemap."
        />
        <CollectionManager
          apiBase="/api/admin/team"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{
            name: '',
            visible: true,
            display_order: 0,
            experience_items: [],
          }}
          itemLabel={(r) => (r.name as string) || 'Team member'}
          statusTone={(r) => (r.visible ? 'success' : 'neutral')}
          emptyHint="No team members yet. Add the first profile to put /team back in the navbar and footer."
        />
      </div>
    </div>
  );
}
