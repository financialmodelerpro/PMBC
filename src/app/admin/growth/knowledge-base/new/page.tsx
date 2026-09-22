import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { KbEditor } from '@/components/admin/growth/kb/KbEditor';
import { ADMIN_COLORS } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { listCaseStudyOptions } from '@/lib/growth/kb';
import { isKbKind, kbKind } from '@/lib/growth/kbModel';

export const metadata: Metadata = { title: 'New item | Knowledge Base | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewKbItemPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const { kind } = await props.searchParams;
  if (typeof kind !== 'string' || !isKbKind(kind) || kbKind(kind).fixed) notFound();
  const cfg = kbKind(kind);
  const caseStudies = cfg.link === 'case_study' ? await listCaseStudyOptions() : [];
  return (
    <>
      <Link href={`/admin/growth/knowledge-base?kind=${kind}`} style={{ fontSize: 13, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
        Back to {cfg.label}
      </Link>
      <div style={{ height: 12 }} />
      <AdminPageHeader eyebrow="Knowledge Base" title={`New ${cfg.singular.toLowerCase()}`} description={`${cfg.purpose} It starts as a draft: AI agents do not read it until you approve it.`} />
      <KbEditor item={{ id: null, kind, title: '', content: {}, site_service_slug: null, case_study_id: null, status: 'draft' }} caseStudies={caseStudies} />
    </>
  );
}
