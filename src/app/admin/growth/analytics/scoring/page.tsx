import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DecideReview, FactorTable, RunReview } from '@/components/admin/growth/analytics/ScoringReviewControls';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { tableExists } from '@/lib/growth/db';
import { dateTime } from '@/lib/growth/format';
import { MIN_EACH } from '@/lib/growth/scoring/review';
import { listReviews } from '@/lib/growth/scoringReview';

export const metadata: Metadata = { title: 'Scoring review | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ScoringReviewPage() {
  await requireGrowthSession();
  const ready = await tableExists('growth_scoring_reviews');
  const reviews = ready ? await listReviews() : [];
  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title="Scoring review"
        description={`Compares scores with real outcomes and suggests new weights for your approval. Conservative: it needs at least ${MIN_EACH} positive and ${MIN_EACH} negative outcomes, damps every move, and changes nothing until you approve.`}
        actions={<Link href="/admin/growth/analytics">Analytics</Link>}
      />
      {!ready && <MigrationNotice migration="093_growth_intelligence.sql" table="growth_scoring_reviews" effect="Reviews can be run and read, but not saved or approved, until then." />}
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <RunReview />
      </section>
      {reviews.map((r) => (
        <section key={r.id} style={{ ...adminCard, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{r.kind === 'prospect' ? 'Prospect Score' : 'Lead Score'}</strong>
            <span style={adminBadge(r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'neutral' : 'warning')}>{r.status}</span>
            <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              {dateTime(r.created_at)}, {r.positives} positive and {r.negatives} negative outcomes
            </span>
            {r.is_test && <span style={adminBadge('neutral')}>Test</span>}
          </div>
          {r.analysis.factors && <FactorTable factors={r.analysis.factors.map((f) => ({ ...f, current: r.current_weights[f.factor], suggested: r.suggested_weights[f.factor] }))} />}
          {r.status === 'pending' ? (
            <div style={{ marginTop: 10 }}>
              <DecideReview id={r.id} />
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              {r.status} by {r.decided_by_name} {dateTime(r.decided_at)}
              {r.decision_note ? `: ${r.decision_note}` : ''}
            </p>
          )}
        </section>
      ))}
    </>
  );
}
