import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AgentModelsForm, ChatOpeningForm, ChatSettingsForm, MeetingsSettingsForm, NurtureSettingsForm, LeadWeightsForm, ScoringWeightsForm, SignalFeedForm } from '@/components/admin/growth/settings/EngineForms';
import { KeywordLibrary } from '@/components/admin/growth/settings/KeywordLibrary';
import { SettingsTabs } from '@/components/admin/growth/settings/SettingsTabs';
import { ADMIN_COLORS } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { isMockMode } from '@/lib/growth/ai/provider';
import { getEngineSettings, pendingMigration } from '@/lib/growth/engineSettings';
import { getKeywordLibrary } from '@/lib/growth/keywords';
import { nurtureConfigured } from '@/lib/growth/nurture';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Engine settings | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthEngineSettingsPage() {
  await requireGrowthSession();
  const page = growthPage('settings');
  const [read, library] = await Promise.all([getEngineSettings(), getKeywordLibrary()]);
  const v = read.values;
  const p = (...keys: Parameters<typeof pendingMigration>[1]) => pendingMigration(read, keys);

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <SettingsTabs active="engine" />
      {read.source === 'error' && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the settings: {read.error}</p>}
      <SignalFeedForm values={v} pending={p('signal_feed_paused', 'signal_feed_max_per_run')} />
      <KeywordLibrary initial={library} />
      <ScoringWeightsForm values={v} pending={p('scoring_weights')} />
      <LeadWeightsForm values={v} pending={p('outreach_sending_paused', 'lead_scoring_weights')} />
      <ChatSettingsForm values={v} pending={p('chat_widget_enabled', 'chat_max_messages', 'chat_max_conversations_per_ip_per_day', 'chat_consent_text', 'lead_alert_email')} mock={isMockMode()} />
      <ChatOpeningForm values={v} pending={p('chat_auto_open', 'chat_auto_open_delay_seconds', 'chat_auto_open_scroll_percent')} />
      <MeetingsSettingsForm values={v} pending={p('bookings_url')} />
      <NurtureSettingsForm values={v} pending={p('nurture_enabled', 'partner_checkin_days')} configured={nurtureConfigured()} />
      <AgentModelsForm values={v} pending={p('agent_models')} />
    </>
  );
}
