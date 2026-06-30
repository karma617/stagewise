import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { useTrack } from '@ui/hooks/use-track';
import { useI18n } from '@ui/hooks/use-i18n';
import type {
  CustomEndpoint,
  CustomModel,
  ModelCapabilities,
  ModelProvider,
  ProviderEndpointMode,
  UserPreferences,
} from '@shared/karton-contracts/ui/shared-types';
import {
  PROVIDER_DISPLAY_INFO,
  PROVIDER_OFFICIAL_URLS,
} from '@shared/karton-contracts/ui/shared-types';
import type {
  BuiltInModel,
  SelectableBuiltInModel,
} from '@shared/available-models';
import {
  availableModelAliases,
  getAvailableModel,
  getSelectableBuiltInModels,
} from '@shared/available-models';
import {
  getEnabledModelThinkingOption,
  getModelThinkingDisplayState,
  getModelThinkingOptions,
  type ModelThinkingDisplayState,
} from '@ui/utils/model-thinking';
import { ModelThinkingPanel } from '@ui/components/model-thinking-panel';
import {
  CODING_PLANS,
  type CodingPlan,
  type CodingPlanId,
} from '@shared/coding-plans';
import { CodingPlanCard } from '@ui/components/coding-plan-card';
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react';

import { cn } from '@ui/utils';
import { useIsTruncated } from '@ui/hooks/use-is-truncated';
import { useScrollFadeMask } from '@ui/hooks/use-scroll-fade-mask';
import {
  RadioGroup,
  Radio,
  RadioLabel,
} from '@stagewise/stage-ui/components/radio';
import { Input } from '@stagewise/stage-ui/components/input';
import { Button } from '@stagewise/stage-ui/components/button';
import { Select } from '@stagewise/stage-ui/components/select';
import { Switch } from '@stagewise/stage-ui/components/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogFooter,
} from '@stagewise/stage-ui/components/dialog';
import { produceWithPatches, enablePatches } from 'immer';
import {
  IconChevronRightOutline18,
  IconChevronDownOutline18,
  IconPlusOutline18,
  IconPenOutline18,
  IconTrashOutline18,
} from 'nucleo-ui-outline-18';

enablePatches();

const EMPTY_CUSTOM_MODELS: UserPreferences['customModels'] = [];
const EMPTY_CUSTOM_ENDPOINTS: UserPreferences['customEndpoints'] = [];
const EMPTY_MODEL_THINKING_OVERRIDES: UserPreferences['agent']['modelThinkingOverrides'] =
  {};
const RECOMMENDED_MODEL_IDS = availableModelAliases.map(
  (alias) => alias.modelId,
);

// =============================================================================
// Model Provider Configuration
// =============================================================================

const PROVIDERS: ModelProvider[] = [
  'anthropic',
  'openai',
  'google',
  'moonshotai',
  'alibaba',
  'deepseek',
  'z-ai',
  'minimax',
  'xiaomi-mimo',
  'mistral',
];

function getThinkingDefaultOptionsForModel(
  model: BuiltInModel,
  preferences: UserPreferences,
): Parameters<typeof getModelThinkingDisplayState>[2] {
  const provider = model.officialProvider;
  if (!provider) return { providerMode: 'stagewise' };

  const config = preferences.providerConfigs[provider];
  if (config.mode !== 'custom') return { providerMode: config.mode };

  const endpoint = preferences.customEndpoints.find(
    (item) => item.id === config.customProviderId,
  );
  if (!endpoint) return { providerMode: 'stagewise' };

  return {
    providerMode: 'custom',
    customEndpointApiSpec: endpoint.apiSpec,
  };
}

function ProviderConfigCard({ provider }: { provider: ModelProvider }) {
  const { t } = useI18n();
  const setSettingsRoute = useKartonProcedure(
    (p) => p.appScreen.setSettingsRoute,
  );
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);
  const setProviderApiKey = useKartonProcedure(
    (p) => p.preferences.setProviderApiKey,
  );
  const clearProviderApiKey = useKartonProcedure(
    (p) => p.preferences.clearProviderApiKey,
  );
  const validateProviderApiKey = useKartonProcedure(
    (p) => p.preferences.validateProviderApiKey,
  );

  const config = preferences.providerConfigs?.[provider] ?? {
    mode: 'stagewise' as const,
  };
  const displayInfo = PROVIDER_DISPLAY_INFO[provider];
  const officialUrl = PROVIDER_OFFICIAL_URLS[provider];
  const customEndpoints =
    preferences?.customEndpoints ?? EMPTY_CUSTOM_ENDPOINTS;

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validated, setValidated] = useState<
    null | { success: true } | { success: false; error: string }
  >(null);
  const hasKey = !!config.encryptedApiKey;
  const connectedCodingPlan = config.connectedCodingPlanId
    ? CODING_PLANS[config.connectedCodingPlanId as CodingPlanId]
    : undefined;
  const hasActiveCodingPlanConnection =
    config.mode === 'official' &&
    hasKey &&
    connectedCodingPlan?.provider === provider;

  useEffect(() => {
    if (validated?.success) {
      const timer = setTimeout(() => setValidated(null), 2_000);
      return () => clearTimeout(timer);
    }
  }, [validated]);

  const handleModeChange = useCallback(
    async (newMode: unknown) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.providerConfigs[provider].mode = newMode as ProviderEndpointMode;
      });
      await updatePreferences(patches);
    },
    [preferences, provider, updatePreferences],
  );

  const handleCustomProviderChange = useCallback(
    async (endpointId: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.providerConfigs[provider].customProviderId = endpointId;
      });
      await updatePreferences(patches);
    },
    [preferences, provider, updatePreferences],
  );

  const handleSaveAndValidate = useCallback(
    async (key: string) => {
      if (!key.trim()) return;
      const trimmedKey = key.trim();

      if (config.mode === 'official') {
        setIsValidating(true);
        setValidated(null);
        try {
          const result = await validateProviderApiKey(provider, trimmedKey);
          if (result && !result.success) {
            setValidated({ success: false, error: result.error });
            return;
          }
        } catch {
          setValidated({
            success: false,
            error: 'Validation request failed. Please try again.',
          });
          return;
        } finally {
          setIsValidating(false);
        }
      }

      setIsSavingKey(true);
      try {
        await setProviderApiKey(provider, trimmedKey);
        setApiKeyInput('');
        setValidated({ success: true });
      } finally {
        setIsSavingKey(false);
      }
    },
    [provider, config, setProviderApiKey, validateProviderApiKey],
  );

  const handleClearApiKey = useCallback(async () => {
    await clearProviderApiKey(provider);
    setValidated(null);
  }, [provider, clearProviderApiKey]);

  const customProviderItems = customEndpoints.map((ep) => ({
    value: ep.id,
    label: ep.name,
  }));

  return (
    <div className="space-y-3 rounded-lg border border-derived p-3">
      <div className="-mt-1">
        <h3 className="font-medium text-foreground text-sm">
          {displayInfo.name}
        </h3>
        <p className="text-muted-foreground text-xs">
          {displayInfo.description}
        </p>
      </div>

      {hasActiveCodingPlanConnection && (
        <p className="rounded-md border border-derived bg-surface-1 px-2 py-1.5 text-muted-foreground text-xs">
          {t('settings.models.connected.viaPlan').replace(
            '{plan}',
            connectedCodingPlan.displayNameKey
              ? t(connectedCodingPlan.displayNameKey)
              : connectedCodingPlan.displayName,
          )}
        </p>
      )}

      <RadioGroup value={config.mode} onValueChange={handleModeChange}>
        <RadioLabel>
          <Radio value="stagewise" />
          <span>{t('settings.models.use.stagewise')}</span>
        </RadioLabel>

        <RadioLabel>
          <Radio value="official" />
          <span>{t('settings.models.use.ownKey').replace('{provider}', displayInfo.name)}</span>
        </RadioLabel>

        <RadioLabel>
          <Radio value="custom" />
          <span>{t('settings.models.use.custom')}</span>
        </RadioLabel>
      </RadioGroup>

      {/* Official mode: API key fields */}
      {config.mode === 'official' && (
        <div className="grid grid-cols-1 gap-3 border-derived border-t pt-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-xs">
              {t('settings.models.dialog.endpointUrl')}
            </p>
            <Input
              value={
                connectedCodingPlan?.provider === provider &&
                connectedCodingPlan.baseUrl
                  ? connectedCodingPlan.baseUrl
                  : officialUrl
              }
              disabled
              size="sm"
              style={{ maxWidth: 'none' }}
            />
          </div>

          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-xs">
              {t('settings.models.apiKey')}
              {isValidating && (
                <span className="ml-1.5 font-normal text-subtle-foreground">
                  {t('settings.models.validating')}
                </span>
              )}
              {!isValidating && validated?.success && (
                <span className="ml-1.5 font-normal text-success-foreground">
                  {t('settings.models.updated')}
                </span>
              )}
            </p>
            <div className="flex gap-1.5">
              <Input
                type="password"
                value={apiKeyInput}
                placeholder={
                  hasKey || validated
                    ? '••••••••••••••••••••••••••••••••'
                    : t('settings.models.apiKeyPlaceholder')
                }
                onValueChange={(v) => {
                  setApiKeyInput(v);
                  setValidated(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyInput.trim()) {
                    void handleSaveAndValidate(apiKeyInput);
                  }
                }}
                onBlur={() => {
                  if (apiKeyInput.trim()) {
                    void handleSaveAndValidate(apiKeyInput);
                  }
                }}
                disabled={isValidating || isSavingKey}
                size="sm"
                style={{ maxWidth: 'none' }}
                className="min-w-0 flex-1"
              />
              {apiKeyInput ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSaveAndValidate(apiKeyInput)}
                  disabled={isValidating || isSavingKey}
                >
                  {t('settings.models.save')}
                </Button>
              ) : hasKey ? (
                <Button variant="ghost" size="sm" onClick={handleClearApiKey}>
                  {t('settings.models.clear')}
                </Button>
              ) : null}
            </div>
            {validated && !validated.success && (
              <TruncatedErrorText text={validated.error} />
            )}
          </div>
        </div>
      )}

      {/* Custom provider mode: select from configured providers */}
      {config.mode === 'custom' && (
        <div className="border-derived border-t pt-3">
          {customEndpoints.length === 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {t('settings.models.empty')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSettingsRoute({ section: 'custom-providers' })
                }
              >
                {t('settings.models.configureProviders')}
                <IconChevronRightOutline18 className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-xs">
                {t('settings.models.dialog.provider')}
              </p>
              <Select
                value={config.customProviderId ?? ''}
                onValueChange={handleCustomProviderChange}
                items={customProviderItems}
                placeholder={t('settings.models.dialog.providerPlaceholder')}
                size="md"
                triggerClassName="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Coding Plans Section
// =============================================================================

function SettingsCodingPlanCard({ plan }: { plan: CodingPlan }) {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const connectCodingPlan = useKartonProcedure(
    (p) => p.preferences.connectCodingPlan,
  );
  const disconnectProvider = useKartonProcedure(
    (p) => p.preferences.disconnectProvider,
  );
  const openExternalUrl = useKartonProcedure((p) => p.openExternalUrl);

  const config = preferences.providerConfigs?.[plan.provider] ?? {
    mode: 'stagewise' as const,
  };

  const handleConnect = useCallback(
    (planId: typeof plan.id, apiKey: string) =>
      connectCodingPlan(planId, apiKey),
    [connectCodingPlan],
  );

  const handleDisconnect = useCallback(async () => {
    // Atomic: flips mode back to 'stagewise' AND clears the encrypted key in
    // a single patch update on the backend. No partial-state window.
    await disconnectProvider(plan.provider);
  }, [plan.provider, disconnectProvider]);

  const handleGetApiKey = useCallback(
    (url: string) => {
      void openExternalUrl(url);
    },
    [openExternalUrl],
  );

  return (
    <CodingPlanCard
      plan={plan}
      config={config}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onGetApiKey={handleGetApiKey}
    />
  );
}

function CodingPlansSection() {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const plans = useMemo(() => Object.values(CODING_PLANS), []);
  const primary = plans.slice(0, 2);
  const secondary = plans.slice(2);
  return (
    <div className="space-y-3">
      {primary.map((plan) => (
        <SettingsCodingPlanCard key={plan.id} plan={plan} />
      ))}
      {showAll &&
        secondary.map((plan) => (
          <SettingsCodingPlanCard key={plan.id} plan={plan} />
        ))}
      {secondary.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t('settings.models.showLess')
              : t('settings.models.showMorePlans').replace(
                  '{count}',
                  String(secondary.length),
                )}
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Model Providers Section
// =============================================================================

function ModelProvidersSection() {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const primary = PROVIDERS.slice(0, 3);
  const secondary = PROVIDERS.slice(3);
  return (
    <div className="space-y-3">
      {primary.map((provider) => (
        <ProviderConfigCard key={provider} provider={provider} />
      ))}
      {showAll &&
        secondary.map((provider) => (
          <ProviderConfigCard key={provider} provider={provider} />
        ))}
      {secondary.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t('settings.models.showLess')
              : t('settings.models.showMoreProviders').replace(
                  '{count}',
                  String(secondary.length),
                )}
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Model Components
// =============================================================================

const BUILT_IN_MODEL_IDS = new Set(
  getSelectableBuiltInModels().map((m) => m.modelId),
) as Set<string>;

function CustomModelDialog({
  model,
  open,
  onOpenChange,
  onSave,
  existingModelIds,
  customEndpoints,
}: {
  model?: CustomModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: Omit<CustomModel, 'providerOptions' | 'headers'> & {
      providerOptions: Record<string, unknown>;
      headers: Record<string, string>;
    },
  ) => void;
  existingModelIds: Set<string>;
  customEndpoints: CustomEndpoint[];
}) {
  const { t } = useI18n();
  // Pages run under a different preload than the sidebar UI, so we cannot
  // import `@ui/hooks/use-track` here (it reaches for `window.electron`).
  // `useTrack` from the pages hooks routes through the pages-API
  // `captureTelemetry` bridge and swallows RPC errors so a failed capture
  // can never crash the page.
  const track = useTrack();
  const isAddMode = !model;
  // Set to true when onSave() fires; distinguishes a save-initiated close
  // from a cancel/dismiss close inside the shared `handleDialogOpenChange`.
  const savedRef = useRef(false);

  const [modelId, setModelId] = useState(model?.modelId ?? '');
  const [displayName, setDisplayName] = useState(model?.displayName ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [contextWindowSize, setContextWindowSize] = useState(
    model?.contextWindowSize ?? 128000,
  );
  const [endpointId, setEndpointId] = useState(model?.endpointId ?? 'openai');
  const [thinkingEnabled, setThinkingEnabled] = useState(
    model?.thinkingEnabled ?? false,
  );
  const defaultCaps: ModelCapabilities = {
    inputModalities: {
      text: true,
      audio: false,
      image: false,
      video: false,
      file: false,
    },
    outputModalities: {
      text: true,
      audio: false,
      image: false,
      video: false,
      file: false,
    },
    toolCalling: true,
  };
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(
    model?.capabilities ?? defaultCaps,
  );
  const [providerOptionsJson, setProviderOptionsJson] = useState(
    model?.providerOptions && Object.keys(model.providerOptions).length > 0
      ? JSON.stringify(model.providerOptions, null, 2)
      : '',
  );
  const [headersJson, setHeadersJson] = useState(
    model?.headers && Object.keys(model.headers).length > 0
      ? JSON.stringify(model.headers, null, 2)
      : '',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [scrollViewport, setScrollViewport] = useState<HTMLElement | null>(
    null,
  );
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  scrollViewportRef.current = scrollViewport;
  const { maskStyle } = useScrollFadeMask(scrollViewportRef, {
    axis: 'vertical',
    fadeDistance: 24,
  });

  // Depend ONLY on `open` so the effect runs exactly on the open/close
  // transitions. Reading `model`/`isAddMode`/`track` without listing them
  // as deps is intentional — we want their values at the moment the
  // dialog opened, not whenever parent re-renders push new references.
  // Without this scoping, normal parent re-renders would silently reset
  // the user's in-progress form input and re-emit `*-add-started`.
  useEffect(() => {
    if (!open) return;
    setModelId(model?.modelId ?? '');
    setDisplayName(model?.displayName ?? '');
    setDescription(model?.description ?? '');
    setContextWindowSize(model?.contextWindowSize ?? 128000);
    setEndpointId(model?.endpointId ?? 'openai');
    setThinkingEnabled(model?.thinkingEnabled ?? false);
    setCapabilities(model?.capabilities ?? defaultCaps);
    setProviderOptionsJson(
      model?.providerOptions && Object.keys(model.providerOptions).length > 0
        ? JSON.stringify(model.providerOptions, null, 2)
        : '',
    );
    setHeadersJson(
      model?.headers && Object.keys(model.headers).length > 0
        ? JSON.stringify(model.headers, null, 2)
        : '',
    );
    setShowAdvanced(false);
    setJsonError(null);
    savedRef.current = false;
    if (isAddMode) {
      track('custom-model-add-started');
    }
  }, [open]);

  const isDuplicate =
    modelId.trim().length > 0 &&
    (BUILT_IN_MODEL_IDS.has(modelId.trim()) ||
      (existingModelIds.has(modelId.trim()) &&
        modelId.trim() !== model?.modelId));

  const canSave =
    modelId.trim().length > 0 &&
    displayName.trim().length > 0 &&
    !isDuplicate &&
    !jsonError;

  // "Touched" = the user changed anything from the initial field values.
  // Derived from current state so we don't need per-input bookkeeping.
  const anyFieldTouched =
    modelId !== (model?.modelId ?? '') ||
    displayName !== (model?.displayName ?? '') ||
    description !== (model?.description ?? '') ||
    contextWindowSize !== (model?.contextWindowSize ?? 128000) ||
    endpointId !== (model?.endpointId ?? 'openai') ||
    thinkingEnabled !== (model?.thinkingEnabled ?? false) ||
    providerOptionsJson !==
      (model?.providerOptions && Object.keys(model.providerOptions).length > 0
        ? JSON.stringify(model.providerOptions, null, 2)
        : '') ||
    headersJson !==
      (model?.headers && Object.keys(model.headers).length > 0
        ? JSON.stringify(model.headers, null, 2)
        : '') ||
    JSON.stringify(capabilities) !==
      JSON.stringify(model?.capabilities ?? defaultCaps);

  // A pristine, unmodified form is NOT an error — empty required fields
  // at initial state mean "not filled in yet", not "validation failed".
  // `had_validation_errors` should only be true when the user entered
  // input that triggered a concrete validation rule (duplicate ID, invalid
  // JSON in provider options / headers).
  const hadValidationErrors = isDuplicate || jsonError !== null;

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && open && isAddMode && !savedRef.current) {
      track('custom-model-add-aborted', {
        had_validation_errors: hadValidationErrors,
        any_field_touched: anyFieldTouched,
      });
    }
    onOpenChange(next);
  };

  const endpointOptions = useMemo(() => {
    const builtIn = [
      { value: 'anthropic', label: 'Anthropic', group: 'Built-in' },
      { value: 'openai', label: 'OpenAI', group: 'Built-in' },
      { value: 'google', label: 'Google', group: 'Built-in' },
      { value: 'moonshotai', label: 'Moonshot AI', group: 'Built-in' },
      { value: 'alibaba', label: 'Alibaba Cloud', group: 'Built-in' },
      { value: 'deepseek', label: 'DeepSeek', group: 'Built-in' },
      { value: 'z-ai', label: 'Z.ai', group: 'Built-in' },
      { value: 'minimax', label: 'MiniMax', group: 'Built-in' },
      { value: 'xiaomi-mimo', label: 'Xiaomi MiMo', group: 'Built-in' },
      { value: 'mistral', label: 'Mistral', group: 'Built-in' },
    ];
    const custom = customEndpoints.map((ep) => ({
      value: ep.id,
      label: ep.name,
      group: 'Custom',
    }));
    return [...builtIn, ...custom];
  }, [customEndpoints]);

  const handleSave = () => {
    let providerOptions: Record<string, unknown> = {};
    let headers: Record<string, string> = {};

    if (providerOptionsJson.trim()) {
      try {
        providerOptions = JSON.parse(providerOptionsJson);
      } catch {
        setJsonError('Invalid JSON in Provider Options');
        return;
      }
    }
    if (headersJson.trim()) {
      try {
        headers = JSON.parse(headersJson);
      } catch {
        setJsonError('Invalid JSON in Headers');
        return;
      }
    }

    onSave({
      modelId: modelId.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
      contextWindowSize,
      endpointId,
      thinkingEnabled,
      capabilities,
      providerOptions,
      headers,
    });
    if (isAddMode) {
      track('custom-model-add-finished');
    }
    savedRef.current = true;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-md">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{model ? t('settings.models.dialog.title.edit') : t('settings.models.dialog.title.add')}</DialogTitle>
          <DialogDescription>
            {t('settings.models.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <OverlayScrollbar
          className="mask-alpha min-h-0 flex-1"
          style={maskStyle}
          onViewportRef={setScrollViewport}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs">{t('settings.models.dialog.modelId')}</p>
              <Input
                placeholder={t('settings.models.dialog.modelIdPlaceholder')}
                value={modelId}
                onValueChange={(val) => {
                  setModelId(val);
                  setJsonError(null);
                }}
                size="sm"
              />
              {isDuplicate && (
                <p className="text-error-foreground text-xs">
                  {t('settings.models.dialog.modelIdExists')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs">
                {t('settings.models.dialog.displayName')}
              </p>
              <Input
                placeholder={t('settings.models.dialog.displayNamePlaceholder')}
                value={displayName}
                onValueChange={setDisplayName}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs">
                {t('settings.models.dialog.description.label')}{' '}
                <span className="font-normal text-muted-foreground">
                  {t('settings.customProviders.dialog.regionOptional')}
                </span>
              </p>
              <Input
                placeholder={t('settings.models.dialog.descriptionPlaceholder')}
                value={description}
                onValueChange={setDescription}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs">
                {t('settings.models.dialog.contextWindow')}
              </p>
              <Input
                type="number"
                value={String(contextWindowSize)}
                onValueChange={(val) =>
                  setContextWindowSize(Number.parseInt(val, 10) || 128000)
                }
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs">{t('settings.models.dialog.endpoint')}</p>
              <Select
                value={endpointId}
                onValueChange={(val) => setEndpointId(val as string)}
                items={endpointOptions}
                size="md"
                triggerClassName="w-full"
              />
            </div>

            {/* Capabilities */}
            <div className="space-y-3 border-derived border-t pt-3">
              <p className="font-medium text-foreground text-xs">
                {t('settings.models.dialog.capabilities')}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {/* biome-ignore lint/a11y/noLabelWithoutControl: base-ui Switch renders a button, label click delegates correctly */}
                <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
                  <Switch
                    checked={thinkingEnabled}
                    onCheckedChange={setThinkingEnabled}
                    size="xs"
                  />
                  {t('settings.models.dialog.thinking')}
                </label>

                {/* biome-ignore lint/a11y/noLabelWithoutControl: base-ui Switch renders a button, label click delegates correctly */}
                <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
                  <Switch
                    checked={capabilities.toolCalling}
                    onCheckedChange={(v) =>
                      setCapabilities((c) => ({ ...c, toolCalling: v }))
                    }
                    size="xs"
                  />
                  {t('settings.models.dialog.toolCalling')}
                </label>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">
                  {t('settings.models.dialog.inputModalities')}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {(['text', 'image', 'audio', 'video', 'file'] as const).map(
                    (mod) => (
                      // biome-ignore lint/a11y/noLabelWithoutControl: base-ui Switch renders a button, label click delegates correctly
                      <label
                        key={mod}
                        className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs"
                      >
                        <Switch
                          checked={capabilities.inputModalities[mod]}
                          onCheckedChange={(v) =>
                            setCapabilities((c) => ({
                              ...c,
                              inputModalities: {
                                ...c.inputModalities,
                                [mod]: v,
                              },
                            }))
                          }
                          size="xs"
                        />
                        {mod}
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">
                  {t('settings.models.dialog.outputModalities')}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {(['text', 'image', 'audio', 'video', 'file'] as const).map(
                    (mod) => (
                      // biome-ignore lint/a11y/noLabelWithoutControl: base-ui Switch renders a button, label click delegates correctly
                      <label
                        key={mod}
                        className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs"
                      >
                        <Switch
                          checked={capabilities.outputModalities[mod]}
                          onCheckedChange={(v) =>
                            setCapabilities((c) => ({
                              ...c,
                              outputModalities: {
                                ...c.outputModalities,
                                [mod]: v,
                              },
                            }))
                          }
                          size="xs"
                        />
                        {mod}
                      </label>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="border-derived border-t pt-3">
              <button
                type="button"
                className="flex w-full items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <IconChevronDownOutline18
                  className={`size-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
                {t('settings.models.advanced')}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">
                      {t('settings.models.dialog.providerOptionsJson')}
                    </p>
                    <textarea
                      className="w-full rounded-lg border border-derived p-2 font-mono text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-muted-foreground/35"
                      rows={3}
                      placeholder='{"reasoningEffort": "high"}'
                      value={providerOptionsJson}
                      onChange={(e) => {
                        setProviderOptionsJson(e.target.value);
                        setJsonError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">
                      {t('settings.models.dialog.headersJson')}
                    </p>
                    <textarea
                      className="w-full rounded-lg border border-derived p-2 font-mono text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-muted-foreground/35"
                      rows={3}
                      placeholder='{"x-custom-header": "value"}'
                      value={headersJson}
                      onChange={(e) => {
                        setHeadersJson(e.target.value);
                        setJsonError(null);
                      }}
                    />
                  </div>
                  {jsonError && (
                    <p className="text-error-foreground text-xs">{jsonError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </OverlayScrollbar>

        <DialogFooter>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
          >
            {model ? t('settings.models.save') : t('settings.models.addModel')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDialogOpenChange(false)}
          >
            {t('settings.models.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuiltInModelCard({
  model,
  isEnabled,
  thinkingDisplay,
  onToggle,
  onEditThinking,
}: {
  model: SelectableBuiltInModel;
  isEnabled: boolean;
  thinkingDisplay: ModelThinkingDisplayState | null;
  onToggle: () => void;
  onEditThinking: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      data-model-card
      className={cn(
        'group/model-card cursor-pointer rounded-lg border border-derived bg-surface-1 p-3',
        !isEnabled && 'opacity-60',
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="-mt-1 min-w-0 flex-1">
          <h3 className="font-medium text-foreground text-sm">
            {model.modelDisplayName}
            {thinkingDisplay && (
              <span className="ml-1.5 font-normal text-subtle-foreground">
                {thinkingDisplay.label}
              </span>
            )}
          </h3>
          <p className="text-muted-foreground text-xs">
            {model.modelId} &middot;{' '}
            {model.officialProvider
              ? PROVIDER_DISPLAY_INFO[model.officialProvider].name
              : t('settings.models.unknown')}{' '}
            &middot; {model.modelContext}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {thinkingDisplay && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-thinking-edit-trigger
              className="h-5 px-1.5 opacity-0 transition-opacity group-focus-within/model-card:opacity-100 group-hover/model-card:opacity-100"
              onClick={onEditThinking}
            >
              {t('settings.models.edit')}
            </Button>
          )}
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle()}
            size="xs"
            aria-label={t(
              isEnabled
                ? 'settings.models.disableModelAria'
                : 'settings.models.enableModelAria',
            ).replace('{name}', model.modelDisplayName)}
          />
        </div>
      </div>
    </div>
  );
}

function CustomModelCard({
  model,
  endpointName,
  isEnabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  model: CustomModel;
  endpointName: string;
  isEnabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border border-derived bg-surface-1 p-3',
        !isEnabled && 'opacity-60',
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="-mt-1 min-w-0 flex-1">
          <h3 className="font-medium text-foreground text-sm">
            {model.displayName}
          </h3>
          <p className="truncate text-muted-foreground text-xs">
            {model.modelId} &middot; {endpointName} &middot;{' '}
            {Math.round(model.contextWindowSize / 1000)}k context
          </p>
          {model.description && (
            <p className="mt-0.5 truncate text-muted-foreground/70 text-xs">
              {model.description}
            </p>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onEdit}
            className="size-4"
          >
            <IconPenOutline18 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            className="mr-0.5 size-4"
          >
            <IconTrashOutline18 className="size-3.5" />
          </Button>
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle()}
            size="xs"
            aria-label={t(
              isEnabled
                ? 'settings.models.disableModelAria'
                : 'settings.models.enableModelAria',
            ).replace('{name}', model.displayName)}
          />
        </div>
      </div>
    </div>
  );
}

function CustomModelsSection() {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const customModels = preferences?.customModels ?? EMPTY_CUSTOM_MODELS;
  const customEndpoints =
    preferences?.customEndpoints ?? EMPTY_CUSTOM_ENDPOINTS;
  const disabledModelIds = useMemo(
    () => new Set(preferences.agent.disabledModelIds),
    [preferences.agent.disabledModelIds],
  );
  const thinkingOverrides =
    preferences.agent.modelThinkingOverrides ?? EMPTY_MODEL_THINKING_OVERRIDES;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<CustomModel | undefined>(
    undefined,
  );

  const existingModelIds = useMemo(
    () => new Set(customModels.map((m) => m.modelId)),
    [customModels],
  );

  const resolveEndpointName = useCallback(
    (endpointId: string) => {
      if (endpointId === 'anthropic') return 'Anthropic';
      if (endpointId === 'openai') return 'OpenAI';
      if (endpointId === 'google') return 'Google';
      if (endpointId === 'moonshotai') return 'Moonshot AI';
      if (endpointId === 'alibaba') return 'Alibaba Cloud';
      if (endpointId === 'deepseek') return 'DeepSeek';
      if (endpointId === 'z-ai') return 'Z.ai';
      if (endpointId === 'minimax') return 'MiniMax';
      if (endpointId === 'xiaomi-mimo') return 'Xiaomi MiMo';
      if (endpointId === 'mistral') return 'Mistral';
      return (
        customEndpoints.find((ep) => ep.id === endpointId)?.name ??
        t('settings.models.unknown')
      );
    },
    [customEndpoints, t],
  );

  const [searchQuery, setSearchQuery] = useState('');

  const filteredBuiltIn = useMemo(() => {
    const selectableModels = getSelectableBuiltInModels({
      disabledModelIds: RECOMMENDED_MODEL_IDS,
    });
    if (!searchQuery.trim()) return selectableModels;
    const q = searchQuery.toLowerCase();
    return selectableModels.filter(
      (m) =>
        m.modelId.toLowerCase().includes(q) ||
        m.modelDisplayName.toLowerCase().includes(q) ||
        (m.officialProvider &&
          PROVIDER_DISPLAY_INFO[m.officialProvider].name
            .toLowerCase()
            .includes(q)),
    );
  }, [searchQuery]);

  const filteredCustom = useMemo(() => {
    if (!searchQuery.trim()) return customModels;
    const q = searchQuery.toLowerCase();
    return customModels.filter(
      (m) =>
        m.modelId.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        resolveEndpointName(m.endpointId).toLowerCase().includes(q),
    );
  }, [searchQuery, customModels, resolveEndpointName]);

  const [listScrollViewport, setListScrollViewport] =
    useState<HTMLElement | null>(null);
  const listScrollRef = useRef<HTMLElement | null>(null);
  listScrollRef.current = listScrollViewport;
  const { maskStyle: listMaskStyle } = useScrollFadeMask(listScrollRef, {
    axis: 'vertical',
    fadeDistance: 24,
  });

  const listContainerRef = useRef<HTMLDivElement>(null);
  const thinkingPanelRef = useRef<HTMLDivElement>(null);
  const thinkingPanelAnchorRef = useRef<HTMLElement | null>(null);
  const [thinkingPanelModelId, setThinkingPanelModelId] = useState<
    string | null
  >(null);
  const [thinkingPanelCenterY, setThinkingPanelCenterY] = useState(0);
  const [thinkingPanelOffset, setThinkingPanelOffset] = useState(0);
  const [thinkingPanelLeft, setThinkingPanelLeft] = useState(0);
  const [thinkingPanelSide, setThinkingPanelSide] = useState<'left' | 'right'>(
    'right',
  );

  const thinkingPanelModel = useMemo(
    () =>
      thinkingPanelModelId
        ? getAvailableModel(thinkingPanelModelId)
        : undefined,
    [thinkingPanelModelId],
  );

  const updateThinkingPanelOffset = useCallback(() => {
    if (
      !thinkingPanelModelId ||
      !thinkingPanelRef.current ||
      !listContainerRef.current
    ) {
      return;
    }

    const panel = thinkingPanelRef.current;
    const panelHeight = panel.offsetHeight;
    const panelWidth = panel.offsetWidth;
    const container = listContainerRef.current;
    const containerHeight = container.offsetHeight;
    const anchorRect = thinkingPanelAnchorRef.current?.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const panelGap = 4;

    if (anchorRect) {
      const rightSpace = window.innerWidth - anchorRect.right;
      const leftSpace = anchorRect.left;
      const side =
        rightSpace >= panelWidth + panelGap || rightSpace >= leftSpace
          ? 'right'
          : 'left';
      const rawLeft =
        side === 'right'
          ? anchorRect.right - containerRect.left + panelGap
          : anchorRect.left - containerRect.left - panelWidth - panelGap;
      const minLeft = panelGap - containerRect.left;
      const maxLeft =
        window.innerWidth - containerRect.left - panelWidth - panelGap;

      setThinkingPanelSide(side);
      setThinkingPanelLeft(Math.min(Math.max(rawLeft, minLeft), maxLeft));
    }
    const centerY = anchorRect
      ? anchorRect.top + anchorRect.height / 2 - containerRect.top
      : thinkingPanelCenterY;
    let offset = centerY - panelHeight / 2;
    offset = Math.max(0, offset);
    offset = Math.min(offset, Math.max(0, containerHeight - panelHeight));
    setThinkingPanelOffset(offset);
  }, [thinkingPanelCenterY, thinkingPanelModelId]);

  useLayoutEffect(() => {
    updateThinkingPanelOffset();
  }, [updateThinkingPanelOffset]);

  useEffect(() => {
    if (
      !thinkingPanelModelId ||
      !thinkingPanelRef.current ||
      !listContainerRef.current
    ) {
      return;
    }

    const observer = new ResizeObserver(() => updateThinkingPanelOffset());
    observer.observe(thinkingPanelRef.current);
    observer.observe(listContainerRef.current);
    listScrollViewport?.addEventListener('scroll', updateThinkingPanelOffset);
    window.addEventListener('resize', updateThinkingPanelOffset);
    updateThinkingPanelOffset();

    return () => {
      observer.disconnect();
      listScrollViewport?.removeEventListener(
        'scroll',
        updateThinkingPanelOffset,
      );
      window.removeEventListener('resize', updateThinkingPanelOffset);
    };
  }, [listScrollViewport, thinkingPanelModelId, updateThinkingPanelOffset]);

  useEffect(() => {
    if (!thinkingPanelModelId) return;
    if (
      filteredBuiltIn.some((model) => model.modelId === thinkingPanelModelId)
    ) {
      return;
    }
    setThinkingPanelModelId(null);
  }, [filteredBuiltIn, thinkingPanelModelId]);

  useEffect(() => {
    if (!thinkingPanelModelId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (thinkingPanelRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('[data-thinking-edit-trigger]')
      ) {
        return;
      }
      setThinkingPanelModelId(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [thinkingPanelModelId]);

  const handleAdd = useCallback(() => {
    setEditingModel(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((m: CustomModel) => {
    setEditingModel(m);
    setDialogOpen(true);
  }, []);

  const handleEditThinking = useCallback(
    (modelId: string, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();

      const container = listContainerRef.current;
      const target = event.currentTarget;
      const anchor = target.closest<HTMLElement>('[data-model-card]') ?? target;
      thinkingPanelAnchorRef.current = target;

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = anchor.getBoundingClientRect();
        setThinkingPanelCenterY(
          itemRect.top + itemRect.height / 2 - containerRect.top,
        );
      }

      setThinkingPanelModelId((current) => {
        if (current === modelId) {
          thinkingPanelAnchorRef.current = null;
          return null;
        }
        return modelId;
      });
    },
    [],
  );

  const handleSetThinkingEnabled = useCallback(
    async (modelId: string, enabled: boolean) => {
      const model = getAvailableModel(modelId);
      if (!model) return;
      const targetModelId = model.modelId;

      const route = getThinkingDefaultOptionsForModel(model, preferences);
      const option = enabled
        ? getEnabledModelThinkingOption(
            model,
            thinkingOverrides[targetModelId]?.value,
            route,
          )
        : (getModelThinkingOptions(model, route).find(
            (item) => item.value === thinkingOverrides[targetModelId]?.value,
          ) ?? getModelThinkingOptions(model, route)[0]);
      if (!option) return;

      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.agent.modelThinkingOverrides[targetModelId] = {
          ...draft.agent.modelThinkingOverrides[targetModelId],
          enabled,
          provider: option.provider,
          value: option.value,
        };
      });
      await updatePreferences(patches);
    },
    [preferences, thinkingOverrides, updatePreferences],
  );

  const handleSetThinkingValue = useCallback(
    async (modelId: string, value: string) => {
      const model = getAvailableModel(modelId);
      if (!model) return;
      const targetModelId = model.modelId;

      const route = getThinkingDefaultOptionsForModel(model, preferences);
      const option = getModelThinkingOptions(model, route).find(
        (item) => item.value === value,
      );
      if (!option) return;

      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.agent.modelThinkingOverrides[targetModelId] = {
          enabled: true,
          provider: option.provider,
          value: option.value,
        };
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  const handleResetThinkingOverride = useCallback(
    async (modelId: string) => {
      const targetModelId = getAvailableModel(modelId)?.modelId ?? modelId;
      const [, patches] = produceWithPatches(preferences, (draft) => {
        delete draft.agent.modelThinkingOverrides[targetModelId];
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  const handleSave = useCallback(
    async (
      data: Omit<CustomModel, 'providerOptions' | 'headers'> & {
        providerOptions: Record<string, unknown>;
        headers: Record<string, string>;
      },
    ) => {
      if (editingModel) {
        const idx = customModels.findIndex(
          (m) => m.modelId === editingModel.modelId,
        );
        if (idx === -1) return;
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customModels[idx] = data;
        });
        await updatePreferences(patches);
      } else {
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customModels.push(data);
        });
        await updatePreferences(patches);
      }
    },
    [editingModel, customModels, preferences, updatePreferences],
  );

  const handleDelete = useCallback(
    async (modelId: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        const idx = draft.customModels.findIndex((m) => m.modelId === modelId);
        if (idx !== -1) {
          draft.customModels.splice(idx, 1);
        }
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  const handleToggleModel = useCallback(
    async (modelId: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        const idx = draft.agent.disabledModelIds.indexOf(modelId);
        if (idx === -1) {
          draft.agent.disabledModelIds.push(modelId);
        } else {
          draft.agent.disabledModelIds.splice(idx, 1);
        }
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  const noResults =
    searchQuery.trim().length > 0 &&
    filteredBuiltIn.length === 0 &&
    filteredCustom.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder={t('settings.models.filter.placeholder')}
          value={searchQuery}
          onValueChange={setSearchQuery}
          size="sm"
          className="flex-1"
          style={{ maxWidth: 'none' }}
        />
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          <IconPlusOutline18 className="size-3.5" />
          {t('settings.models.addModel')}
        </Button>
      </div>

      <div ref={listContainerRef} className="relative">
        <OverlayScrollbar
          className="mask-alpha h-96"
          style={listMaskStyle}
          onViewportRef={setListScrollViewport}
          contentClassName="space-y-3"
        >
          {filteredBuiltIn.map((model) => (
            <BuiltInModelCard
              key={model.modelId}
              model={model}
              isEnabled={!disabledModelIds.has(model.modelId)}
              thinkingDisplay={getModelThinkingDisplayState(
                model.targetModel,
                thinkingOverrides[model.modelId],
                getThinkingDefaultOptionsForModel(
                  model.targetModel,
                  preferences,
                ),
              )}
              onToggle={() => handleToggleModel(model.modelId)}
              onEditThinking={(event) =>
                handleEditThinking(model.modelId, event)
              }
            />
          ))}

          {filteredCustom.map((model) => (
            <CustomModelCard
              key={model.modelId}
              model={model}
              endpointName={resolveEndpointName(model.endpointId)}
              isEnabled={!disabledModelIds.has(model.modelId)}
              onToggle={() => handleToggleModel(model.modelId)}
              onEdit={() => handleEdit(model)}
              onDelete={() => handleDelete(model.modelId)}
            />
          ))}

          {noResults && (
            <div className="rounded-lg border border-derived-subtle p-4">
              <p className="text-center text-muted-foreground text-sm">
                {t('settings.models.filter.noMatch')}
              </p>
            </div>
          )}
        </OverlayScrollbar>

        {thinkingPanelModel && (
          <div
            ref={thinkingPanelRef}
            className={cn(
              'absolute z-10 flex w-64 flex-col rounded-lg border border-derived bg-background text-foreground text-xs shadow-lg transition-[top] duration-100 ease-out',
              thinkingPanelSide === 'right'
                ? 'fade-in-0 slide-in-from-left-1 animate-in duration-150'
                : 'fade-in-0 slide-in-from-right-1 animate-in duration-150',
            )}
            style={{ top: thinkingPanelOffset, left: thinkingPanelLeft }}
          >
            <ModelThinkingPanel
              model={thinkingPanelModel}
              override={thinkingOverrides[thinkingPanelModel.modelId]}
              defaultOptions={getThinkingDefaultOptionsForModel(
                thinkingPanelModel,
                preferences,
              )}
              onEnabledChange={(enabled) =>
                handleSetThinkingEnabled(thinkingPanelModel.modelId, enabled)
              }
              onValueChange={(value) =>
                handleSetThinkingValue(thinkingPanelModel.modelId, value)
              }
              onReset={() =>
                handleResetThinkingOverride(thinkingPanelModel.modelId)
              }
            />
          </div>
        )}
      </div>

      <CustomModelDialog
        model={editingModel}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        existingModelIds={existingModelIds}
        customEndpoints={customEndpoints}
      />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export function ModelsProvidersSection() {
  const { t } = useI18n();
  const setSettingsRoute = useKartonProcedure(
    (p) => p.appScreen.setSettingsRoute,
  );

  return (
    <div className="h-full w-full">
      {/* Content */}
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-semibold text-foreground text-xl">
              {t('settings.models.title')}
            </h1>
          </div>
          {/* Coding Plans Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">
                {t('settings.models.codingPlans')}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t('settings.models.codingPlans.description')}
              </p>
            </div>

            <CodingPlansSection />
          </section>

          <hr className="border-derived-subtle border-t" />

          {/* API Keys Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">
                {t('settings.models.apiKeys')}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t('settings.models.apiKeys.description')}
              </p>
            </div>

            <ModelProvidersSection />
          </section>

          <hr className="border-derived-subtle border-t" />

          {/* Models Section */}
          <section className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium text-foreground text-lg">
                  {t('settings.models.modelsTitle')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t('settings.models.models.description')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSettingsRoute({ section: 'custom-providers' })
                  }
                >
                  {t('settings.models.customProviders')}
                  <IconChevronRightOutline18 className="size-3" />
                </Button>
              </div>
            </div>

            <CustomModelsSection />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}

function TruncatedErrorText({ text }: { text: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLParagraphElement>(null);
  const { isTruncated, tooltipOpen, setTooltipOpen } = useIsTruncated(ref);

  return (
    <Tooltip open={isTruncated && tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger>
        <p ref={ref} className={cn('truncate text-2xs text-error-foreground')}>
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <div className="wrap-break-word line-clamp-12 max-h-48 max-w-xs overflow-y-auto text-2xs leading-relaxed">
          {text}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
