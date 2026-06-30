import { Button } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { HotkeyActions } from '@shared/hotkeys';
import { HotkeyCombo } from '@ui/components/hotkey-combo';
import { GlobePlusIcon } from './globe-plus-icon';
import { WindowPlusIcon } from '../terminal-panel/_components/window-plus-icon';
import { useI18n } from '@ui/hooks/use-i18n';

interface NewTabButtonsProps {
  onCreateBrowserTab: () => void;
  onCreateTerminalTab: () => void;
  buttonClassName?: string;
}

export function NewTabButtons({
  onCreateBrowserTab,
  onCreateTerminalTab,
  buttonClassName,
}: NewTabButtonsProps) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 flex-row items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('chat.newTab.openNewBrowserTab')}
            className={buttonClassName}
            onClick={onCreateBrowserTab}
          >
            <GlobePlusIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span className="flex items-center gap-1.5">
            <span>{t('chat.newTab.openBrowserTab')}</span>
            <HotkeyCombo action={HotkeyActions.NEW_TAB} size="xs" />
          </span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('chat.newTab.openNewTerminalTab')}
            className={buttonClassName}
            onClick={onCreateTerminalTab}
          >
            <WindowPlusIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span className="flex items-center gap-1.5">
            <span>{t('chat.newTab.openTerminalTab')}</span>
            <HotkeyCombo action={HotkeyActions.NEW_TERMINAL_TAB} size="xs" />
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
