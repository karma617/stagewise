import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { IconXmarkFill18 } from 'nucleo-ui-fill-18';
import { IconFolder5Outline18 } from 'nucleo-ui-outline-18';
import { Loader2Icon } from 'lucide-react';

import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import { useTrack } from '@ui/hooks/use-track';
import { useOpenAgent } from '@ui/hooks/use-open-chat';
import { EMPTY_MOUNTS } from '@shared/karton-contracts/ui';
import { useI18n } from '@ui/hooks/use-i18n';

/**
 * Empty-chat suggestion list.
 *
 * Current scope (intentional minimal mode):
 * - Always renders "Connect &lt;recent-workspace&gt;" rows, regardless of
 *   whether any workspaces are already mounted. The strip below the chat
 *   input owns the "Connect new workspace" affordance via its `+` button,
 *   so this list never duplicates that.
 */

/**
 * How many recent workspace rows to show. Dismissing one promotes the
 * next-most-recent into view.
 */
const RECENT_WORKSPACE_LIMIT = 3;
const CHAT_INPUT_FOCUS_REQUESTED_EVENT = 'chat-input-focus-requested';
const MOUNT_CONFIRM_TIMEOUT_MS = 800;
const MOUNT_CONFIRM_INTERVAL_MS = 50;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface EmptyChatSuggestionsProps {
  removedSuggestionIds: Set<string>;
  onDismiss: (id: string) => void;
}

export const EmptyChatSuggestions = memo(function EmptyChatSuggestions({
  removedSuggestionIds,
  onDismiss,
}: EmptyChatSuggestionsProps) {
  const { t } = useI18n();
  const [openAgent] = useOpenAgent();
  const recentlyOpenedWorkspaces = useKartonState(
    (s) => s.userExperience.storedExperienceData.recentlyOpenedWorkspaces,
  );
  const allMounts = useKartonState((s) =>
    openAgent
      ? (s.toolbox[openAgent]?.workspace?.mounts ?? EMPTY_MOUNTS)
      : EMPTY_MOUNTS,
  );
  const mountedPaths = useMemo(
    () => new Set(allMounts.map((m) => m.path)),
    [allMounts],
  );
  const mountedPathsRef = useRef(mountedPaths);
  mountedPathsRef.current = mountedPaths;
  const allMountsCountRef = useRef(allMounts.length);
  allMountsCountRef.current = allMounts.length;
  const connectingPathRef = useRef<string | null>(null);
  const [connectingPath, setConnectingPath] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const mountWorkspace = useKartonProcedure((p) => p.toolbox.mountWorkspace);
  const track = useTrack();

  // Filter dismissed entries BEFORE the slice so that dismissing a
  // recent workspace promotes the next-most-recent one into view.
  const sortedRecents = useMemo(() => {
    return [...recentlyOpenedWorkspaces]
      .filter((w) => !mountedPaths.has(w.path))
      .filter((w) => !removedSuggestionIds.has(`connect-workspace-${w.path}`))
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, RECENT_WORKSPACE_LIMIT);
  }, [recentlyOpenedWorkspaces, mountedPaths, removedSuggestionIds]);

  // Connecting a workspace deliberately keeps other recent workspaces
  // visible. The newly mounted workspace drops out of the list
  // automatically via the `mountedPaths` filter above.
  const connect = useCallback(
    async (path: string) => {
      if (!openAgent || connectingPathRef.current) return;
      const mountCountBefore = allMountsCountRef.current;
      connectingPathRef.current = path;
      setConnectingPath(path);
      setConnectError(null);
      track('workspace-connect-started');
      try {
        await mountWorkspace(openAgent, path);
        const deadline = Date.now() + MOUNT_CONFIRM_TIMEOUT_MS;
        while (
          !mountedPathsRef.current.has(path) &&
          allMountsCountRef.current <= mountCountBefore &&
          Date.now() < deadline
        ) {
          await wait(MOUNT_CONFIRM_INTERVAL_MS);
        }
        if (
          !mountedPathsRef.current.has(path) &&
          allMountsCountRef.current <= mountCountBefore
        ) {
          setConnectError(t('chat.emptySuggestions.workspaceNoMount'));
          track('workspace-connect-failed', {
            source: 'recent-workspace',
            reason: 'mount-not-observed',
          });
          return;
        }
        track('workspace-connect-finished');
        window.dispatchEvent(new Event(CHAT_INPUT_FOCUS_REQUESTED_EVENT));
      } catch (error) {
        track('workspace-connect-failed', { source: 'recent-workspace' });
        setConnectError(
          error instanceof Error
            ? error.message
            : t('chat.workspace.error.connectFailed'),
        );
      } finally {
        connectingPathRef.current = null;
        setConnectingPath(null);
      }
    },
    [openAgent, mountWorkspace, track, t],
  );

  if (sortedRecents.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-1">
      {sortedRecents.map((workspace) => {
        const id = `connect-workspace-${workspace.path}`;
        return (
          <SuggestionRow
            key={workspace.path}
            disabled={connectingPath !== null}
            onActivate={() => {
              track('suggestion-clicked', {
                suggestion_id: id,
                context: 'empty-chat',
              });
              void connect(workspace.path);
            }}
            icon={
              connectingPath === workspace.path ? (
                <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <IconFolder5Outline18 className="size-3.5 shrink-0" />
              )
            }
            onDismiss={
              connectingPath === null ? () => onDismiss(id) : undefined
            }
            dismissTooltip={t('chat.emptySuggestions.dismiss')}
          >
            <span className="shrink-0 text-sm leading-tight">
              {connectingPath === workspace.path
                ? t('chat.emptySuggestions.connecting').replace(
                    '{workspace}',
                    workspace.name,
                  )
                : t('chat.emptySuggestions.connect').replace(
                    '{workspace}',
                    workspace.name,
                  )}
            </span>
            <span
              className="ml-2 min-w-0 flex-1 truncate text-2xs text-subtle-foreground leading-normal group-hover/suggestion:text-muted-foreground"
              dir="rtl"
            >
              <span dir="ltr">{workspace.path}</span>
            </span>
          </SuggestionRow>
        );
      })}
      {connectError && (
        <div className="px-2.5 text-error-foreground text-xs leading-normal">
          {connectError}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Shared row chrome
// ============================================================================
//
// Chrome conventions:
// - Left icon swaps to a dismiss-cross on hover when dismissable.
// - Hover/focus highlight on the entire row, click anywhere activates.

function SuggestionRow({
  onActivate,
  icon,
  onDismiss,
  dismissTooltip,
  onHoverEnter,
  disabled = false,
  children,
}: {
  onActivate: () => void;
  icon: React.ReactNode;
  onDismiss?: () => void;
  dismissTooltip?: string;
  onHoverEnter?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onActivate();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      onMouseEnter={onHoverEnter}
      className={cn(
        'group/suggestion relative flex w-full cursor-pointer flex-row items-center gap-2.5 rounded-lg px-2.5 py-1 text-muted-foreground outline-none',
        'hover:bg-hover-derived hover:text-foreground',
        'focus-visible:bg-hover-derived focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary-solid/40',
        disabled && 'cursor-wait opacity-80',
      )}
    >
      {/* Left icon: swaps to dismiss-cross on hover when dismissable.
          The resting icon and the X are siblings; both have explicit
          opacity classes so the resting icon actually fades out (a
          `display: contents` wrapper would not — opacity needs a box). */}
      {onDismiss ? (
        <Tooltip>
          <TooltipTrigger>
            <button
              type="button"
              data-dismiss
              aria-label={dismissTooltip ?? 'Dismiss suggestion'}
              className="group/dismiss relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-solid/40"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
            >
              <span className="flex size-3.5 items-center justify-center group-hover/suggestion:opacity-0 group-focus-visible/suggestion:opacity-0">
                {icon}
              </span>
              <IconXmarkFill18 className="absolute size-3.5 text-muted-foreground opacity-0 group-hover/dismiss:text-foreground group-hover/suggestion:opacity-100 group-focus-visible/suggestion:opacity-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{dismissTooltip ?? 'Dismiss'}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}
