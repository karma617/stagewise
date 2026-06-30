import { Button } from '@stagewise/stage-ui/components/button';
import { IconMediaStopFill18 } from 'nucleo-ui-fill-18';
import { stripMountPrefix } from '@ui/utils';
import { getBaseName } from '@shared/path-utils';
import { Loader2Icon, XIcon } from 'lucide-react';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type { StatusCardSection } from './shared';
import type { MouseEvent } from 'react';
import { FileIcon } from '@ui/components/file-icon';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

export type WorkspaceMdStatus = 'hidden' | 'running' | 'completed' | 'error';

export interface WorkspaceMdStatusSectionProps {
  status: WorkspaceMdStatus;
  sectionKey: string;
  workspaceName?: string;
  history: AgentMessage[];
  errorMessage?: string | null;
  onDismiss: () => void;
  onShowFile: (workspacePath?: string) => void;
  onGenerate?: () => void;
  onStop?: () => void;
  labels?: {
    contextGenerationFailed: string;
    dismiss: string;
    done: string;
    failedGenerateWorkspaceMd: string;
    generated: string;
    generatingContext: (workspace: string) => string;
    showFile: string;
    stop: string;
    stopContextGeneration: string;
    tryAgain: string;
  };
}

function relativizePath(filePath: string | undefined): string | undefined {
  if (!filePath) return filePath;
  return stripMountPrefix(filePath);
}

/**
 * Extract status text from the last tool call in agent history.
 * Searches through ALL assistant messages (in reverse order) to find the
 * most recent tool part with a valid state, not just the last message.
 */
function getStatusText(history: AgentMessage[]): string {
  const INITIALIZING_TEXT = 'Initializing .stagewise/WORKSPACE.md...';
  const ANALYZING_TEXT = 'Analyzing workspace...';

  // Get all assistant messages
  const assistantMessages = history?.filter((m) => m.role === 'assistant');
  const lastMessage = assistantMessages?.at(-1);

  // Search through all assistant messages in reverse order to find the last valid tool part
  let lastToolPart: AgentToolUIPart | undefined;
  for (
    let i = (assistantMessages?.length ?? 0) - 1;
    i >= 0 && !lastToolPart;
    i--
  ) {
    const msg = assistantMessages![i]!;
    const toolParts = msg.parts.filter((p) =>
      p.type.startsWith('tool-'),
    ) as AgentToolUIPart[];
    const filteredParts = toolParts.filter(
      (p) => p.state === 'input-available' || p.state === 'output-available',
    );
    lastToolPart = filteredParts.at(-1);
  }

  switch (lastToolPart?.type) {
    case 'tool-read': {
      const stripped = relativizePath(lastToolPart.input?.path);
      const fileName = getBaseName(stripped ?? '');
      return fileName ? `Reading ${fileName}...` : 'Reading file...';
    }
    case 'tool-ls': {
      const stripped = relativizePath(lastToolPart.input?.path);
      const dirName = getBaseName(stripped ?? '');
      return dirName ? `Listing ${dirName}...` : 'Listing directory...';
    }
    case 'tool-glob': {
      const pattern = lastToolPart.input?.pattern;
      return pattern ? `Searching for ${pattern}...` : 'Searching files...';
    }
    case 'tool-grepSearch': {
      const query = lastToolPart.input?.query;
      return query ? `Searching code for ${query}...` : 'Searching code...';
    }
    case 'tool-write': {
      return 'Writing WORKSPACE.md...';
    }
    default: {
      if (!lastMessage) return INITIALIZING_TEXT;

      const hadOverwritingWorkspaceMd = assistantMessages?.some((m) =>
        m.parts.some((p) => p.type === 'tool-write'),
      );
      const lastType = lastMessage.parts.at(-1)?.type;
      if (
        (lastType === 'reasoning' || lastType === 'text') &&
        hadOverwritingWorkspaceMd
      )
        return 'Finishing up...';

      return ANALYZING_TEXT;
    }
  }
}

function TooltipWrapper({
  children,
  showTooltip,
  content,
}: {
  children: React.ReactElement;
  showTooltip: boolean;
  content: string;
}) {
  if (!showTooltip) return children;
  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

export function WorkspaceMdStatusSection({
  status,
  sectionKey,
  workspaceName,
  history,
  errorMessage,
  onDismiss,
  onShowFile,
  onGenerate,
  onStop,
  labels = {
    contextGenerationFailed: 'Context generation failed:',
    dismiss: 'Dismiss',
    done: 'Done',
    failedGenerateWorkspaceMd: 'Failed to generate .stagewise/WORKSPACE.md',
    generated: 'generated',
    generatingContext: (workspace) => `Generating context for ${workspace}...`,
    showFile: 'Show file',
    stop: 'Stop',
    stopContextGeneration: 'Stop the context generation',
    tryAgain: 'Try Again',
  },
}: WorkspaceMdStatusSectionProps): StatusCardSection | null {
  if (status === 'hidden') return null;

  const isRunning = status === 'running';
  const isError = status === 'error';
  const statusText = getStatusText(history);
  return {
    key: sectionKey,
    defaultOpen: true,
    trigger: () => (
      <div className="flex h-6 w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
        {isRunning ? (
          <div className="flex w-full shrink cursor-default flex-row items-center gap-1">
            <TooltipWrapper showTooltip={isRunning} content={statusText}>
              <div className="-ml-1 flex min-w-0 shrink flex-row items-center gap-1">
                <div className="relative flex size-5 shrink-0 items-center justify-center">
                  <Loader2Icon className="size-3 animate-spin text-primary-foreground" />
                </div>
                <span className="shimmer-text-primary truncate font-normal">
                  {labels.generatingContext(workspaceName ?? '')}
                </span>
              </div>
            </TooltipWrapper>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto shrink-0 cursor-pointer"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    onStop?.();
                  }}
                >
                  {labels.stop}
                  <IconMediaStopFill18 className="size-2.5 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{labels.stopContextGeneration}</TooltipContent>
            </Tooltip>
          </div>
        ) : isError ? (
          <div className="flex w-full min-w-0 cursor-default flex-row items-center justify-between gap-1 truncate">
            <div className="flex size-5 shrink-0 flex-row items-center justify-center">
              <XIcon className="size-3 shrink-0 text-foreground" />
            </div>
            <Tooltip>
              <TooltipTrigger>
                <span className="truncate font-normal text-muted-foreground">
                  {labels.contextGenerationFailed}{' '}
                  {errorMessage || labels.failedGenerateWorkspaceMd}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {errorMessage || labels.failedGenerateWorkspaceMd}
              </TooltipContent>
            </Tooltip>
            <div className="ml-auto flex shrink-0 flex-row items-center justify-start gap-1 pl-3">
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0 cursor-pointer"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onDismiss();
                }}
              >
                {labels.dismiss}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                className="shrink-0 cursor-pointer"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onGenerate?.();
                }}
              >
                {labels.tryAgain}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 shrink flex-row items-center gap-1 truncate">
              <FileIcon
                filePath=".stagewise/WORKSPACE.md"
                className="size-5 shrink-0"
              />
              <Tooltip>
                <TooltipTrigger>
                  <span className="truncate text-foreground text-xs leading-none">
                    WORKSPACE.md
                  </span>
                </TooltipTrigger>
                <TooltipContent>.stagewise/WORKSPACE.md</TooltipContent>
              </Tooltip>
              <span className="truncate font-normal text-muted-foreground">
                {labels.generated}
              </span>
            </div>
            <div className="ml-auto flex shrink-0 flex-row items-center justify-start gap-1">
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0 cursor-pointer"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onDismiss();
                }}
              >
                {labels.done}
              </Button>
              <Button
                variant="primary"
                size="xs"
                className="shrink-0 cursor-pointer"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onShowFile();
                }}
              >
                {labels.showFile}
              </Button>
            </div>
          </>
        )}
      </div>
    ),
    content: undefined,
  };
}
