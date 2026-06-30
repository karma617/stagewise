import { Button } from '@stagewise/stage-ui/components/button';
import { ZapIcon } from 'lucide-react';
import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import { useI18n } from '@ui/hooks/use-i18n';
import { useAccountPoolBatchTask } from './account-pool-batch-task-store';

export function AccountPoolBatchTaskFloating() {
  const { t } = useI18n();
  const task = useAccountPoolBatchTask();
  const appScreenMode = useKartonState((s) => s.appScreen.mode);
  const settingsRoute = useKartonState((s) => s.appScreen.settingsRoute);
  const openSettings = useKartonProcedure((p) => p.appScreen.openSettings);

  if (!task || task.status !== 'running') return null;
  if (
    appScreenMode === 'settings' &&
    settingsRoute.section === 'account-pool'
  ) {
    return null;
  }

  const label = t('settings.accountPool.batchTask.floating')
    .replace('{done}', String(task.done))
    .replace('{total}', String(task.total));

  return (
    <Button
      variant="secondary"
      size="sm"
      className="fixed right-4 bottom-4 z-50 h-9 rounded-full bg-background px-3 text-xs shadow-elevation-2 ring-1 ring-border-subtle hover:bg-hover-derived dark:bg-surface-1"
      onClick={() => openSettings({ section: 'account-pool' })}
      aria-label={label}
    >
      <ZapIcon className="size-3.5 text-primary-foreground" />
      <span className="font-medium tabular-nums">{label}</span>
    </Button>
  );
}
