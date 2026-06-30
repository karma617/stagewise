import { useState } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import { Checkbox } from '@stagewise/stage-ui/components/checkbox';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { useKartonProcedure } from '@ui/hooks/use-karton';
import { Loader2Icon } from 'lucide-react';
import { useI18n } from '@ui/hooks/use-i18n';

type DataType =
  | 'history'
  | 'favicons'
  | 'downloads'
  | 'cookies'
  | 'cache'
  | 'storage'
  | 'indexedDB'
  | 'serviceWorkers'
  | 'cacheStorage'
  | 'permissionExceptions';

interface DataOption {
  id: DataType;
  label: string;
  description: string;
}

const dataOptionIds: DataType[] = [
  'history',
  'downloads',
  'cookies',
  'cache',
  'storage',
  'indexedDB',
  'cacheStorage',
  'serviceWorkers',
  'favicons',
  'permissionExceptions',
];

export function ClearDataSection() {
  const { t } = useI18n();
  const dataOptions: DataOption[] = dataOptionIds.map((id) => ({
    id,
    label: t(`settings.clearData.option.${id}.label`),
    description: t(`settings.clearData.option.${id}.description`),
  }));
  const [selectedTypes, setSelectedTypes] = useState<Set<DataType>>(
    new Set([
      'history',
      'downloads',
      'cookies',
      'cache',
      'storage',
      'indexedDB',
      'cacheStorage',
      'serviceWorkers',
      'favicons',
    ] as const),
  );
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const clearBrowsingData = useKartonProcedure(
    (p) => p.browser.clearBrowsingData,
  );

  const toggleDataType = (type: DataType) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const handleClearData = async (timeRange: 'last24h' | 'allTime') => {
    if (selectedTypes.size === 0) {
      setResult({
        success: false,
        message: t('settings.clearData.error.selectAtLeastOne'),
      });
      return;
    }

    setIsClearing(true);
    setResult(null);

    try {
      const now = new Date();
      const options = {
        history: selectedTypes.has('history'),
        favicons: selectedTypes.has('favicons'),
        downloads: selectedTypes.has('downloads'),
        cookies: selectedTypes.has('cookies'),
        cache: selectedTypes.has('cache'),
        storage: selectedTypes.has('storage'),
        indexedDB: selectedTypes.has('indexedDB'),
        serviceWorkers: selectedTypes.has('serviceWorkers'),
        cacheStorage: selectedTypes.has('cacheStorage'),
        permissionExceptions: selectedTypes.has('permissionExceptions'),
        timeRange:
          timeRange === 'last24h'
            ? {
                start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                end: now,
              }
            : undefined,
        vacuum: true,
      };

      const response = await clearBrowsingData(options);

      if (response.success) {
        const clearedItems: string[] = [];
        if (response.historyEntriesCleared) {
          clearedItems.push(
            t(response.historyEntriesCleared === 1 ? 'settings.clearData.summary.historyEntry' : 'settings.clearData.summary.historyEntries').replace('{n}', String(response.historyEntriesCleared)),
          );
        }
        if (response.downloadsCleared === true) {
          clearedItems.push(t('settings.clearData.summary.downloads'));
        }
        if (response.faviconsCleared) {
          clearedItems.push(t('settings.clearData.summary.favicons').replace('{n}', String(response.faviconsCleared)));
        }
        if (response.cookiesCleared) {
          clearedItems.push(t('settings.clearData.summary.cookies'));
        }
        if (response.cacheCleared) {
          clearedItems.push(t('settings.clearData.summary.cache'));
        }
        if (response.storageCleared) {
          clearedItems.push(t('settings.clearData.summary.storage'));
        }
        if (response.permissionExceptionsCleared) {
          clearedItems.push(t('settings.clearData.summary.sitePermissions'));
        }

        setResult({
          success: true,
          message:
            clearedItems.length > 0
              ? t('settings.clearData.success.cleared').replace('{items}', clearedItems.join(', '))
              : t('settings.clearData.success.fallback'),
        });
      } else {
        setResult({
          success: false,
          message: response.error || t('settings.clearData.error.clearFailed'),
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message:
          error instanceof Error ? error.message : t('settings.clearData.error.clearFailed'),
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-full w-full">
      {/* Content */}
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-semibold text-foreground text-xl">
              {t('settings.clearData.title')}
            </h1>
          </div>
          {/* Data Selection Section */}
          <section className="space-y-4">
            <div>
              <h2 className="font-medium text-foreground text-lg">
                {t('settings.clearData.selectHeader')}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {dataOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-derived bg-background p-2.5 transition-colors hover:bg-hover-derived"
                  htmlFor={option.id}
                >
                  <Checkbox
                    id={option.id}
                    checked={selectedTypes.has(option.id)}
                    onCheckedChange={() => toggleDataType(option.id)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-foreground text-sm">
                      {option.label}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {option.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Action Buttons */}
          <section>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => handleClearData('last24h')}
                disabled={isClearing || selectedTypes.size === 0}
                variant="secondary"
                size="sm"
              >
                {isClearing ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    {t('settings.clearData.button.clearing')}
                  </>
                ) : (
                  t('settings.clearData.button.clearLast24h')
                )}
              </Button>

              <Button
                onClick={() => handleClearData('allTime')}
                disabled={isClearing || selectedTypes.size === 0}
                variant="primary"
                size="sm"
              >
                {isClearing ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    {t('settings.clearData.button.clearing')}
                  </>
                ) : (
                  t('settings.clearData.button.clearAllTime')
                )}
              </Button>
            </div>
          </section>

          {/* Result Message */}
          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.success
                  ? 'border border-derived-strong bg-success-background text-success-foreground'
                  : 'border border-derived-strong bg-error-background text-error-foreground'
              }`}
            >
              <p className="text-sm">{result.message}</p>
            </div>
          )}
        </div>
      </OverlayScrollbar>
    </div>
  );
}
