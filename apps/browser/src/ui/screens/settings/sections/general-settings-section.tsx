import { Button } from '@stagewise/stage-ui/components/button';
import { Input } from '@stagewise/stage-ui/components/input';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { Select } from '@stagewise/stage-ui/components/select';
import { Slider } from '@stagewise/stage-ui/components/slider';
import { Switch } from '@stagewise/stage-ui/components/switch';
import { toast } from '@stagewise/stage-ui/components/toaster';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { useTrack } from '@ui/hooks/use-track';
import { PlayIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { useI18n } from '@ui/hooks/use-i18n';
import { enablePatches, produceWithPatches } from 'immer';

enablePatches();

// =============================================================================
// Interface Language Setting Component
// =============================================================================

function LanguageSetting() {
  const { lang, t } = useI18n();
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);

  const items = [
    { value: 'zh-CN', label: t('settings.general.language.zh-CN') },
    { value: 'en', label: t('settings.general.language.en') },
  ];

  const handleChange = async (value: string) => {
    await setGlobalConfig({ appLanguage: value as 'zh-CN' | 'en' });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="app-language-select">
          <h3 className="font-medium text-base text-foreground">
            {t('settings.general.language.label')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('settings.general.language.description')}
          </p>
        </label>
      </div>
      <Select
        value={lang}
        onValueChange={handleChange}
        items={items}
        size="sm"
        triggerClassName="w-32 shrink-0 mt-1"
        side="bottom"
      />
    </div>
  );
}

// =============================================================================
// Power Save Blocker Setting Component
// =============================================================================

function PowerSaveBlockerSetting() {
  const globalConfig = useKartonState((s) => s.globalConfig);
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);
  const { t } = useI18n();

  const isEnabled = globalConfig.blockAppSuspensionWhenAgentsActive ?? true;

  const handleChange = async (checked: boolean) => {
    await setGlobalConfig({
      blockAppSuspensionWhenAgentsActive: checked,
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="agent-power-save-blocker">
          <h3 className="font-medium text-base text-foreground">
            {t('settings.general.powerSave.title')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('settings.general.powerSave.description')}
          </p>
        </label>

        {isMacOs && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-warning-background/45 p-2 text-warning-foreground text-xs leading-snug ring-1 ring-warning-solid/20">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
            <p>
              {t('settings.general.powerSave.macWarning')}
            </p>
          </div>
        )}
      </div>

      <Switch
        id="agent-power-save-blocker"
        checked={isEnabled}
        onCheckedChange={handleChange}
        size="xs"
        className="mt-1 shrink-0"
      />
    </div>
  );
}

// =============================================================================
// LLM Network Setting Component
// =============================================================================

type AgentNetworkField =
  | 'chatProxyUrl'
  | 'clashApiUrl'
  | 'clashApiSecret'
  | 'clashProxyGroup';

function LlmNetworkSetting() {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const updateField = (field: AgentNetworkField, value: string) => {
    const [, patches] = produceWithPatches(preferences, (draft) => {
      draft.agent[field] = value;
    });
    void updatePreferences(patches);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-base text-foreground">
          {t('settings.general.llmNetwork.title')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.general.llmNetwork.description')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5" htmlFor="llm-chat-proxy-url">
          <span className="font-medium text-foreground text-sm">
            {t('settings.general.llmNetwork.proxyUrl')}
          </span>
          <Input
            id="llm-chat-proxy-url"
            size="sm"
            value={preferences.agent.chatProxyUrl}
            placeholder="http://127.0.0.1:7897"
            debounce={300}
            onValueChange={(value) => updateField('chatProxyUrl', value)}
          />
        </label>

        <label className="space-y-1.5" htmlFor="llm-clash-api-url">
          <span className="font-medium text-foreground text-sm">
            {t('settings.general.llmNetwork.clashApiUrl')}
          </span>
          <Input
            id="llm-clash-api-url"
            size="sm"
            value={preferences.agent.clashApiUrl}
            placeholder="http://127.0.0.1:9097"
            debounce={300}
            onValueChange={(value) => updateField('clashApiUrl', value)}
          />
        </label>

        <label className="space-y-1.5" htmlFor="llm-clash-api-secret">
          <span className="font-medium text-foreground text-sm">
            {t('settings.general.llmNetwork.clashSecret')}
          </span>
          <Input
            id="llm-clash-api-secret"
            size="sm"
            type="password"
            value={preferences.agent.clashApiSecret}
            placeholder={t('settings.general.llmNetwork.clashSecretPlaceholder')}
            debounce={300}
            onValueChange={(value) => updateField('clashApiSecret', value)}
          />
        </label>

        <label className="space-y-1.5" htmlFor="llm-clash-proxy-group">
          <span className="font-medium text-foreground text-sm">
            {t('settings.general.llmNetwork.clashProxyGroup')}
          </span>
          <Input
            id="llm-clash-proxy-group"
            size="sm"
            value={preferences.agent.clashProxyGroup}
            placeholder={t('settings.general.llmNetwork.clashProxyGroupPlaceholder')}
            debounce={300}
            onValueChange={(value) => updateField('clashProxyGroup', value)}
          />
        </label>
      </div>

      <p className="text-muted-foreground text-xs">
        {t('settings.general.llmNetwork.note')}
      </p>
    </div>
  );
}

// =============================================================================
// Notifications Setting Component
// =============================================================================

const DEFAULT_SOUND_PACK = 'bubble-pops';
const NOTIFICATION_LOUDNESS_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'default', label: 'Loud' },
] as const;

type SoundLoudness = (typeof NOTIFICATION_LOUDNESS_OPTIONS)[number]['value'];

export function NotificationsSetting() {
  const globalConfig = useKartonState((s) => s.globalConfig);
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);
  const previewSoundPack = useKartonProcedure((p) => p.config.previewSoundPack);
  const importSoundPack = useKartonProcedure((p) => p.config.importSoundPack);
  const track = useTrack();
  const { t } = useI18n();

  const soundLoudness: SoundLoudness =
    globalConfig.notificationSoundLoudness ??
    (globalConfig.notificationSoundsEnabled === false ? 'off' : 'subtle');
  const availablePacks =
    globalConfig.availableSoundPacks.length > 0
      ? globalConfig.availableSoundPacks
      : [DEFAULT_SOUND_PACK];
  const configuredPack = globalConfig.notificationSoundPack?.trim();
  const currentPack =
    configuredPack && availablePacks.includes(configuredPack)
      ? configuredPack
      : DEFAULT_SOUND_PACK;
  const packOptions = availablePacks.includes(currentPack)
    ? availablePacks
    : [currentPack, ...availablePacks];
  const loudnessIndex = Math.max(
    0,
    NOTIFICATION_LOUDNESS_OPTIONS.findIndex(
      (option) => option.value === soundLoudness,
    ),
  );

  const soundPackItems = packOptions.map((pack) => ({
    value: pack,
    label: globalConfig.packDisplayNames[pack] ?? pack,
  }));

  const previewSound = (pack = currentPack, loudness = soundLoudness) => {
    if (loudness === 'off') return;
    void previewSoundPack(pack, loudness).catch(() => {
      // Preview is best-effort; config changes should still succeed.
    });
  };

  const handleLoudnessChange = async (value: number) => {
    const index = Math.max(
      0,
      Math.min(NOTIFICATION_LOUDNESS_OPTIONS.length - 1, Math.round(value)),
    );
    const notificationSoundLoudness =
      NOTIFICATION_LOUDNESS_OPTIONS[index]?.value ?? 'subtle';

    previewSound(currentPack, notificationSoundLoudness);

    await setGlobalConfig({
      notificationSoundsEnabled: notificationSoundLoudness !== 'off',
      notificationSoundLoudness,
    });
    track('changed-notification-sound-loudness', {
      loudness: notificationSoundLoudness,
    });
  };

  const handleSoundPackChange = async (value: unknown) => {
    if (typeof value !== 'string' || !packOptions.includes(value)) return;
    previewSound(value, soundLoudness);
    await setGlobalConfig({
      notificationSoundPack: value,
    });
    track('changed-notification-sound-theme', {
      theme: value === DEFAULT_SOUND_PACK ? value : 'custom',
    });
  };

  const handleImportSoundPack = async () => {
    try {
      const result = await importSoundPack();
      if ('error' in result) {
        if (result.error) {
          toast({
            id: `import-sound-pack-error-${Date.now()}`,
            title: t('settings.general.notifications.import.errorTitle'),
            message: result.error,
            type: 'error',
            actions: [],
          });
        }
        return;
      }

      toast({
        id: `import-sound-pack-success-${Date.now()}`,
        title: t('settings.general.notifications.import.successTitle'),
        message: t('settings.general.notifications.import.successMessage').replace('{name}', result.name),
        type: 'info',
        duration: 4000,
        actions: [],
      });
    } catch (err) {
      toast({
        id: `import-sound-pack-error-${Date.now()}`,
        title: t('settings.general.notifications.import.errorTitle'),
        message:
          err instanceof Error ? err.message : t('settings.general.notifications.import.errorFallback'),
        type: 'error',
        actions: [],
      });
    }
  };

  const handleDockBounceChange = async (checked: boolean) => {
    await setGlobalConfig({
      dockBounceEnabled: checked,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-base text-foreground">
                  {t('settings.general.notifications.title')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('settings.general.notifications.description')}
                </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="font-medium text-foreground text-sm">{t('settings.general.notifications.loudness')}</h4>
          <div className="w-32 space-y-0.5 pl-2">
            <Slider
              value={loudnessIndex}
              min={0}
              max={2}
              step={1}
              ariaLabel={t('settings.general.notifications.loudness')}
              thickness="default"
              onValueChange={handleLoudnessChange}
            />
            <div className="relative h-3 text-[11px] text-muted-foreground">
              {NOTIFICATION_LOUDNESS_OPTIONS.map((option, index) => (
                <span
                  key={option.value}
                  className="absolute -translate-x-1/2"
                  style={{
                    left: `${
                      (index / (NOTIFICATION_LOUDNESS_OPTIONS.length - 1)) * 100
                    }%`,
                  }}
                >
                  {t(`settings.general.notifications.loudness.${option.value}`)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground text-sm">{t('settings.general.notifications.soundPack')}</h4>
          <div className="flex items-center gap-1">
            <Select
              value={currentPack}
              onValueChange={handleSoundPackChange}
              items={soundPackItems}
              size="sm"
              triggerClassName="w-40"
              side="bottom"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={soundLoudness === 'off'}
              onClick={() => previewSound()}
              aria-label={t('settings.general.notifications.previewSound')}
            >
              <PlayIcon className="size-3.5" />
            </Button>
          </div>
          <button
            type="button"
            className="block text-muted-foreground text-xs underline transition-colors hover:text-foreground"
            onClick={handleImportSoundPack}
          >
            <span className="inline-flex items-center gap-1">
              <UploadIcon className="size-3" />
                            {t('settings.general.notifications.useCustomSound')}
                          </span>
          </button>
        </div>
      </div>

      {isMacOs && (
        <div
          className="flex cursor-pointer items-center justify-between gap-4 pt-2"
          onClick={() =>
            handleDockBounceChange(!globalConfig.dockBounceEnabled)
          }
        >
          <div>
            <h3 className="font-medium text-base text-foreground">
                          {t('settings.general.notifications.dockBounce.title')}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {t('settings.general.notifications.dockBounce.description')}
                        </p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={globalConfig.dockBounceEnabled}
              onCheckedChange={handleDockBounceChange}
              size="xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Section Component
// =============================================================================

export function GeneralSettingsSection() {
  const { t } = useI18n();
  return (
    <div className="h-full w-full">
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-semibold text-foreground text-xl">
              {t('settings.general.title')}
            </h1>
          </div>
          <section className="space-y-6">
            <LanguageSetting />
            <PowerSaveBlockerSetting />
            <LlmNetworkSetting />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
