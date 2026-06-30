import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RadioGroup,
  Radio,
  RadioLabel,
} from '@stagewise/stage-ui/components/radio';
import { Button } from '@stagewise/stage-ui/components/button';
import { Input } from '@stagewise/stage-ui/components/input';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@stagewise/stage-ui/components/dialog';
import { produceWithPatches, enablePatches } from 'immer';
import {
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  ChevronRightIcon,
} from 'lucide-react';

enablePatches();

import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { useI18n } from '@ui/hooks/use-i18n';
import { Select } from '@stagewise/stage-ui/components/select';
import type {
  PageSetting,
  ConfigurablePermissionType,
} from '@shared/karton-contracts/ui/shared-types';
import {
  PermissionSetting,
  configurablePermissionTypes,
} from '@shared/karton-contracts/ui/shared-types';

// =============================================================================
// Search Engine Setting Component
// =============================================================================

function SearchEngineSetting() {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const searchEngines = useKartonState((s) => s.searchEngines);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);
  const addSearchEngine = useKartonProcedure((p) => p.browser.addSearchEngine);
  const removeSearchEngine = useKartonProcedure(
    (p) => p.browser.removeSearchEngine,
  );

  const defaultEngineId = preferences.search.defaultEngineId;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEngine, setNewEngine] = useState({
    name: '',
    url: '',
    keyword: '',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDefaultEngineChange = async (value: unknown) => {
    const engineId = Number.parseInt(String(value), 10);
    const [, patches] = produceWithPatches(preferences, (draft) => {
      draft.search.defaultEngineId = engineId;
    });
    await updatePreferences(patches);
  };

  const handleAddEngine = async () => {
    setIsAdding(true);
    setAddError(null);

    const result = await addSearchEngine({
      name: newEngine.name,
      url: newEngine.url,
      keyword: newEngine.keyword,
    });

    setIsAdding(false);

    if (result.success) {
      setIsAddDialogOpen(false);
      setNewEngine({ name: '', url: '', keyword: '' });
    } else {
      setAddError(result.error);
    }
  };

  const handleRemoveEngine = async (id: number) => {
    setDeleteError(null);
    const result = await removeSearchEngine(id);
    if (!result.success) {
      setDeleteError(result.error ?? t('settings.browsing.searchEngine.removeFailed'));
    }
  };

  const isUrlValid =
    newEngine.url.includes('%s') &&
    (() => {
      try {
        new URL(newEngine.url.replace('%s', 'test'));
        return true;
      } catch {
        return false;
      }
    })();

  const canAdd =
    newEngine.name.trim() && newEngine.keyword.trim() && isUrlValid;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-base text-foreground">
          {t('settings.browsing.searchEngine.title')}
        </h3>
      </div>

      <RadioGroup
        value={String(defaultEngineId)}
        onValueChange={handleDefaultEngineChange}
      >
        {searchEngines.map((engine) => (
          <div
            key={engine.id}
            className="flex items-center justify-between gap-4"
          >
            <RadioLabel className="flex-1">
              <Radio value={String(engine.id)} />
              <div className="flex items-center gap-2">
                {engine.faviconUrl && (
                  <img
                    src={engine.faviconUrl}
                    alt=""
                    className="size-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {engine.shortName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {engine.keyword}
                  </span>
                </div>
              </div>
            </RadioLabel>

            {!engine.isBuiltIn && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemoveEngine(engine.id)}
                disabled={engine.id === defaultEngineId}
                title={
                  engine.id === defaultEngineId
                    ? t('settings.browsing.searchEngine.cannotDeleteDefault')
                    : t('settings.browsing.searchEngine.removeEngine')
                }
              >
                <Trash2Icon className="size-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
      </RadioGroup>

      {deleteError && (
        <p className="text-error-foreground text-sm">{deleteError}</p>
      )}

      <div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger>
            <Button variant="secondary" size="sm">
              <PlusIcon className="mr-2 size-4" />
              {t('settings.browsing.searchEngine.add')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogClose />
            <DialogHeader>
              <DialogTitle>{t('settings.browsing.searchEngine.dialogTitle')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="engine-name"
                  className="font-medium text-foreground text-sm"
                >
                  {t('settings.browsing.searchEngine.fieldName')}
                </label>
                <Input
                  id="engine-name"
                  placeholder={t('settings.browsing.searchEngine.placeholderName')}
                  value={newEngine.name}
                  onValueChange={(value) =>
                    setNewEngine((prev) => ({ ...prev, name: value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="engine-keyword"
                  className="font-medium text-foreground text-sm"
                >
                  {t('settings.browsing.searchEngine.fieldKeyword')}
                </label>
                <Input
                  id="engine-keyword"
                  placeholder={t('settings.browsing.searchEngine.placeholderKeyword')}
                  value={newEngine.keyword}
                  onValueChange={(value) =>
                    setNewEngine((prev) => ({ ...prev, keyword: value }))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {t('settings.browsing.searchEngine.keywordHelp')}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="engine-url"
                  className="font-medium text-foreground text-sm"
                >
                  {t('settings.browsing.searchEngine.fieldUrl')}
                </label>
                <Input
                  id="engine-url"
                  placeholder={t('settings.browsing.searchEngine.placeholderUrl')}
                  value={newEngine.url}
                  onValueChange={(value) =>
                    setNewEngine((prev) => ({ ...prev, url: value }))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {t('settings.browsing.searchEngine.urlHelp')}
                </p>
                {newEngine.url && !isUrlValid && (
                  <p className="text-error-foreground text-xs">
                    {t('settings.browsing.searchEngine.urlInvalid')}
                  </p>
                )}
              </div>

              {addError && (
                <p className="text-error-foreground text-sm">{addError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="primary"
                onClick={handleAddEngine}
                disabled={!canAdd || isAdding}
              >
                {isAdding ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    {t('settings.browsing.searchEngine.adding')}
                  </>
                ) : (
                  t('settings.browsing.searchEngine.add')
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsAddDialogOpen(false)}
              >
                {t('settings.browsing.searchEngine.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// =============================================================================
// Page Setting Component (New Tab / Startup)
// =============================================================================

type PageSettingType = 'newTabPage' | 'startupPage';

interface PageSettingProps {
  type: PageSettingType;
  title: string;
  description: string;
}

function PageSettingComponent({ type, title, description }: PageSettingProps) {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const pageSetting = preferences.general[type];

  const [localUrl, setLocalUrl] = useState(pageSetting.customUrl ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state with preferences when they change externally
  useEffect(() => {
    setLocalUrl(pageSetting.customUrl ?? '');
  }, [pageSetting.customUrl]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleTypeChange = async (value: unknown) => {
    const [, patches] = produceWithPatches(preferences, (draft) => {
      draft.general[type].type = value as PageSetting['type'];
    });
    await updatePreferences(patches);
  };

  const handleUrlChange = (value: string) => {
    // Update local state immediately for responsive UI
    setLocalUrl(value);

    // Debounce the preference update
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(async () => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.general[type].customUrl = value;
      });
      await updatePreferences(patches);
    }, 200);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-base text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <RadioGroup value={pageSetting.type} onValueChange={handleTypeChange}>
        <RadioLabel>
          <Radio value="home" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{t('settings.browsing.page.optionHome')}</span>
            <span className="text-muted-foreground text-xs">
              {t('settings.browsing.page.optionHomeDesc')}
            </span>
          </div>
        </RadioLabel>

        <RadioLabel>
          <Radio value="custom" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{t('settings.browsing.page.optionCustom')}</span>
            <span className="text-muted-foreground text-xs">
              {t('settings.browsing.page.optionCustomDesc')}
            </span>
          </div>
        </RadioLabel>
      </RadioGroup>

      {pageSetting.type === 'custom' && (
        <div className="ml-6 space-y-2">
          <Input
            placeholder={t('settings.browsing.page.urlPlaceholder')}
            value={localUrl}
            onValueChange={handleUrlChange}
          />
        </div>
      )}
    </div>
  );
}

function NewTabPageSetting() {
  const { t } = useI18n();
  return (
    <PageSettingComponent
      type="newTabPage"
      title={t('settings.browsing.newTab.title')}
      description={t('settings.browsing.newTab.description')}
    />
  );
}

function StartupPageSetting() {
  const { t } = useI18n();
  return (
    <PageSettingComponent
      type="startupPage"
      title={t('settings.browsing.startup.title')}
      description={t('settings.browsing.startup.description')}
    />
  );
}

// =============================================================================
// Permission Defaults Setting Component
// =============================================================================

/** Human-readable labels for permission types */
const permissionTypeLabelKeys: Record<ConfigurablePermissionType, string> = {
  media: 'settings.browsing.permission.media',
  geolocation: 'settings.browsing.permission.geolocation',
  notifications: 'settings.browsing.permission.notifications',
  fullscreen: 'settings.browsing.permission.fullscreen',
  bluetooth: 'settings.browsing.permission.bluetooth',
  hid: 'settings.browsing.permission.hid',
  serial: 'settings.browsing.permission.serial',
  usb: 'settings.browsing.permission.usb',
  'clipboard-read': 'settings.browsing.permission.clipboardRead',
  'display-capture': 'settings.browsing.permission.displayCapture',
  midi: 'settings.browsing.permission.midi',
  'idle-detection': 'settings.browsing.permission.idleDetection',
  'speaker-selection': 'settings.browsing.permission.speakerSelection',
  'storage-access': 'settings.browsing.permission.storageAccess',
};

/** Human-readable labels for permission settings */
function getPermissionSettingLabel(
  setting: PermissionSetting,
  t: (k: string) => string,
): string {
  if (setting === PermissionSetting.Ask) return t('settings.browsing.permission.setting.ask');
  if (setting === PermissionSetting.Allow) return t('settings.browsing.permission.setting.allow');
  return t('settings.browsing.permission.setting.block');
}

function PermissionDefaultsSetting() {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handlePermissionChange = useCallback(
    async (permissionType: ConfigurablePermissionType, value: string) => {
      const setting = Number.parseInt(value, 10) as PermissionSetting;
      const [, patches] = produceWithPatches(preferences, (draft) => {
        // Ensure structure exists
        if (!draft.permissions) {
          draft.permissions = {
            defaults: {},
            exceptions: {},
          } as typeof draft.permissions;
        }
        if (!draft.permissions.defaults) {
          draft.permissions.defaults = {} as typeof draft.permissions.defaults;
        }
        draft.permissions.defaults[permissionType] = setting;
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  // Permissions that require device selection - "Allow" doesn't make sense
  const deviceSelectionPermissions: ConfigurablePermissionType[] = [
    'bluetooth',
    'hid',
    'serial',
    'usb',
  ];

  const getSettingOptions = (permissionType: ConfigurablePermissionType) => {
    const isDevicePermission =
      deviceSelectionPermissions.includes(permissionType);

    const options = [
      {
        value: String(PermissionSetting.Ask),
        label: getPermissionSettingLabel(PermissionSetting.Ask, t),
        description: t('settings.browsing.permission.setting.askDesc'),
      },
    ];

    // Only add "Allow" for non-device permissions
    if (!isDevicePermission) {
      options.push({
        value: String(PermissionSetting.Allow),
        label: getPermissionSettingLabel(PermissionSetting.Allow, t),
        description: t('settings.browsing.permission.setting.allowDesc'),
      });
    }

    options.push({
      value: String(PermissionSetting.Block),
      label: getPermissionSettingLabel(PermissionSetting.Block, t),
      description: t('settings.browsing.permission.setting.blockDesc'),
    });

    return options;
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-base text-foreground">
          {t('settings.browsing.permissionDefaults.title')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.browsing.permissionDefaults.description')}
        </p>
      </div>

      <div className="space-y-3">
        {configurablePermissionTypes.map((permissionType) => (
          <div
            key={permissionType}
            className="flex items-center justify-between gap-4"
          >
            <span className="font-medium text-foreground text-sm">
              {t(permissionTypeLabelKeys[permissionType])}
            </span>
            <Select
              value={String(
                preferences.permissions?.defaults?.[permissionType] ??
                  PermissionSetting.Ask,
              )}
              onValueChange={(value) =>
                handlePermissionChange(permissionType, value)
              }
              triggerVariant="secondary"
              size="sm"
              triggerClassName="w-28"
              items={getSettingOptions(permissionType)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Website Permission Overrides Component
// =============================================================================

function WebsitePermissionOverrides() {
  const { t } = useI18n();
  const preferences = useKartonState((s) => s.preferences);
  const setSettingsRoute = useKartonProcedure(
    (p) => p.appScreen.setSettingsRoute,
  );

  // Collect all unique hosts that have any permission overrides
  const hostsWithOverrides = (() => {
    const hostMap = new Map<string, number>();
    const exceptions = preferences.permissions?.exceptions;

    if (exceptions) {
      for (const permType of configurablePermissionTypes) {
        const typeExceptions = exceptions[permType];
        if (typeExceptions) {
          for (const host of Object.keys(typeExceptions)) {
            hostMap.set(host, (hostMap.get(host) || 0) + 1);
          }
        }
      }
    }

    // Convert to array and sort by host name
    return Array.from(hostMap.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => a.host.localeCompare(b.host));
  })();

  const handleHostClick = (host: string) => {
    setSettingsRoute({ section: 'website-permissions', host });
  };

  if (hostsWithOverrides.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-base text-foreground">
            {t('settings.browsing.websitePerm.title')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('settings.browsing.websitePerm.descEmpty')}
          </p>
        </div>

        <div className="rounded-lg border border-border/30 bg-surface-1/50 p-4">
          <p className="text-center text-muted-foreground text-sm">
            {t('settings.browsing.websitePerm.empty')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-base text-foreground">
          {t('settings.browsing.websitePerm.title')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.browsing.websitePerm.desc')}
        </p>
      </div>

      <div className="space-y-1">
        {hostsWithOverrides.map(({ host, count }) => (
          <button
            key={host}
            type="button"
            onClick={() => handleHostClick(host)}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-border/30 p-3 text-left transition-colors hover:bg-surface-1"
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground text-sm">
                {host}
              </span>
              <span className="text-muted-foreground text-xs">
                {count !== 1
                ? t('settings.browsing.websitePerm.countMany').replace('{n}', String(count))
                : t('settings.browsing.websitePerm.countOne').replace('{n}', String(count))}
              </span>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export function BrowsingSettingsSection() {
  const { t } = useI18n();
  return (
    <div className="h-full w-full">
      {/* Content */}
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-semibold text-foreground text-xl">{t('settings.browsing.headerTitle')}</h1>
          </div>
          {/* General Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">{t('settings.browsing.section.general')}</h2>
            </div>

            <SearchEngineSetting />

            <div className="pt-2">
              <NewTabPageSetting />
            </div>

            <div className="pt-2">
              <StartupPageSetting />
            </div>
          </section>

          <hr className="border-border/20" />

          {/* Privacy Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">{t('settings.browsing.section.privacy')}</h2>
              <p className="text-muted-foreground text-sm">
                {t('settings.browsing.section.privacyDesc')}
              </p>
            </div>

            <PermissionDefaultsSetting />

            <div className="pt-2">
              <WebsitePermissionOverrides />
            </div>
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
