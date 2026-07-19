import { useKartonState } from '@ui/hooks/use-karton';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from 'lucide-react';

export function StartupBackgroundTasksFloating() {
  const tasks = useKartonState((s) => s.startupBackgroundTasks);
  if (tasks.length === 0) return null;

  const runningTasks = tasks.filter((task) => task.status === 'running');
  const failedTask = [...tasks]
    .reverse()
    .find((task) => task.status === 'failed');
  const succeededTask = [...tasks]
    .reverse()
    .find((task) => task.status === 'succeeded');
  const primaryTask = runningTasks[0] ?? failedTask ?? succeededTask;
  if (!primaryTask) return null;

  const runningSuffix =
    runningTasks.length > 1 ? `等 ${runningTasks.length} 项` : '';
  const label =
    primaryTask.status === 'running'
      ? `后台正在加载：${primaryTask.title}${runningSuffix}`
      : primaryTask.status === 'failed'
        ? `后台加载失败：${primaryTask.title}`
        : `后台加载完成：${primaryTask.title}`;
  const detail =
    primaryTask.status === 'failed' && primaryTask.message
      ? primaryTask.message
      : '你可以继续正常操作，后台任务不会阻塞窗口。';

  return (
    <div className="pointer-events-none fixed top-3 right-4 z-50 max-w-sm">
      <div
        className="pointer-events-auto flex items-start gap-2.5 rounded-xl bg-background/95 px-3 py-2.5 text-foreground shadow-elevation-2 ring-1 ring-border-subtle backdrop-blur dark:bg-surface-1/95"
        role="status"
        aria-live="polite"
      >
        {primaryTask.status === 'running' ? (
          <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-info-foreground" />
        ) : primaryTask.status === 'failed' ? (
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
        ) : (
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success-foreground" />
        )}
        <div className="min-w-0">
          <div className="truncate font-medium text-sm">{label}</div>
          <div className="line-clamp-2 text-muted-foreground text-xs">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}
