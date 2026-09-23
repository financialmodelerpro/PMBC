import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AgentModelsForm, LeadWeightsForm, ScoringWeightsForm, SignalFeedForm } from '@/components/admin/growth/settings/EngineForms';
import { SettingsTabs } from '@/components/admin/growth/settings/SettingsTabs';
import { ADMIN_COLORS } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { getEngineSettings, pendingMigration } from '@/lib/growth/engineSettings';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Engine settings | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthEngineSettingsPage() {
  await requireGrowthSession();
  const page = growthPage('settings');
  const read = await getEngineSettings();
  const v = read.values;
  const p = (...keys: Parameters<typeof pendingMigration>[1]) => pendingMigration(read, keys);

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <SettingsTabs active="engine" />
      {read.source === 'error' && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the settings: {read.error}</p>}
      <SignalFeedForm values={v} pending={p('signal_keywords', 'signal_feed_paused', 'signal_feed_max_per_run')} />
      <ScoringWeightsForm values={v} pending={p('scoring_weights')} />
      <LeadWeightsForm values={v} pending={p('outreach_sending_paused', 'lead_scoring_weights')} />
      <AgentModelsForm values={v} pending={p('agent_models')} />
    </>
  );
}
