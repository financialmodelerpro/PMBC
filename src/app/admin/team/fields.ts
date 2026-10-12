import type { FieldDef } from '@/components/admin/CollectionManager';

/*
 * A member's own details: the one place each is written. The /team card, the
 * header of the member's profile page and the tool reports (for the founding
 * partner) all read these, so nothing here is typed twice.
 *
 * Two column names read differently here than in the database:
 *   credentials -> Qualification    the letters after the name
 *   bio         -> Short bio        the founding partner's /team card only
 *
 * Not offered, though the columns remain: `linkedin_url` and `email` (migration
 * 023; contacts live on the profile header), and `profile_type`,
 * `experience_items` and `expertise_items` (migration 101; the card's
 * highlights come from the profile's list marked "Show on team card").
 */
export const MEMBER_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Muhammad Shahjahan, ACMA' },
  {
    key: 'role',
    label: 'Role',
    type: 'text',
    placeholder: 'Senior Associate, Corporate Finance',
    hint: 'Shown on the card, and as the profile title unless the profile header sets its own.',
  },
  {
    key: 'credentials',
    label: 'Qualification',
    type: 'text',
    placeholder: 'ACMA (ICMAP)',
    hint: 'The letters after the name, kept short. Leave empty if there are none.',
  },
  {
    key: 'experience_years',
    label: 'Experience',
    type: 'text',
    placeholder: '12+ years',
    hint: 'Just the years: "Experience" is added on the site.',
  },
  {
    key: 'location',
    label: 'Location',
    type: 'text',
    placeholder: 'Riyadh, KSA',
  },
  {
    key: 'photo',
    label: 'Photo',
    type: 'media',
    bucket: 'team-photos',
    hint: 'A portrait photo, ideally 4:5, used on the card and the profile. Export it with square corners and no border, coloured line or edge: the site draws the frame, and anything baked into the image shows inside it. Leave empty to show the initials.',
  },
  {
    key: 'visible',
    label: 'Published',
    type: 'checkbox',
    hint: 'Unpublished members are kept but neither their card nor their profile renders. While no member is published, /team is withheld from the navbar, the footer and the sitemap.',
  },
];

/** The founding partner's card on /team also carries a short paragraph. */
export const FOUNDER_BIO_FIELD: FieldDef = {
  key: 'bio',
  label: 'Short bio',
  type: 'richtext',
  hint: 'Shown on the founding partner’s /team card only. His full background lives on the profile below.',
};
