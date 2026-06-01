import type { Metadata } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adminPageMain } from '@/lib/admin/styles';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  ContactSubmissionsClient,
  type ContactSubmission,
} from '@/components/admin/ContactSubmissionsClient';

export const metadata: Metadata = {
  title: 'Contact Submissions | PMBC Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SELECT_COLUMNS =
  'id, name, email, company, phone, country, service_interest, message, source_page, status, notes, created_at, read_at, responded_at';

async function loadSubmissions(): Promise<{ rows: ContactSubmission[]; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('contact_submissions')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as ContactSubmission[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : 'Failed to load' };
  }
}

export default async function ContactSubmissionsPage() {
  const { rows, error } = await loadSubmissions();
  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Inbox"
          title="Contact Submissions"
          description={
            newCount > 0
              ? `${newCount} new ${newCount === 1 ? 'submission' : 'submissions'} awaiting response.`
              : 'Triage and respond to enquiries from the public contact form.'
          }
        />
        <ContactSubmissionsClient initialRows={rows} loadError={error} />
      </div>
    </div>
  );
}
