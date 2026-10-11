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
 *   credentials -> Qualifications   the letters after the name
 *   bio         -> Short bio        the short paragraph of background
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
    label: 'Qualifications',
    type: 'text',
    placeholder: 'ACCA | FMVA | 12+ Years Experience',
    hint: 'The credentials line under the role. Kept short: it renders in small uppercase.',
  },
  {
    key: 'bio',
    label: 'Short bio',
    type: 'richtext',
    hint: 'A short paragraph of background. Keep it brief for a full profile, since the card links through to the profile page.',
  },
  {
    key: 'profile_type',
    label: 'Profile type',
    type: 'select',
    options: [
      { value: 'compact', label: 'Compact: details on the card' },
      { value: 'full', label: 'Full: links to a profile page' },
    ],
    hint: 'Compact shows the bio, Selected experience and Expertise on the card. Full keeps the card short and links to the member’s profile page; a profile page has to be built first, and until it exists the card shows no link.',
  },
  {
    key: 'experience_items',
    label: 'Selected experience',
    type: 'stringList',
    placeholder: 'Co-led advisory on an acquisition in the fertilizer sector',
    hint: 'Compact profiles only. One line per item, up to twelve; four reads best.',
  },
  {
    key: 'expertise_items',
    label: 'Expertise',
    type: 'stringList',
    placeholder: 'Business Valuation',
    hint: 'Compact profiles only. One short item each, shown as small tags.',
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
            profile_type: 'compact',
            experience_items: [],
            expertise_items: [],
          }}
          itemLabel={(r) => (r.name as string) || 'Team member'}
          statusTone={(r) => (r.visible ? 'success' : 'neutral')}
          emptyHint="No team members yet. Add the first profile to put /team back in the navbar and footer."
        />
      </div>
    </div>
  );
}
