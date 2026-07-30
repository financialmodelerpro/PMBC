import { redirect } from 'next/navigation';

/**
 * Alias for the inquiries inbox. The sidebar labels the entry "Inquiries" and
 * points at /admin/contact-submissions (which owns the table name); this alias
 * exists so the shorter /admin/leads URL also resolves.
 */
export default function AdminLeadsAliasPage() {
  redirect('/admin/contact-submissions');
}
