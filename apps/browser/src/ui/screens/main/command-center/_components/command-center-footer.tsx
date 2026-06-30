import { HotkeyActions } from '@shared/hotkeys';
import { ShortcutCombo } from '@stagewise/stage-ui/components/shortcut-key';
import { HotkeyCombo } from '@ui/components/hotkey-combo';
import type {
  AgentCommandItem,
  CommandCenterMode,
  TabCommandItem,
} from '../command-center-model';
import { useI18n } from '@ui/hooks/use-i18n';

export type CommandCenterDeleteConfirmation = {
  agentId: string;
  title: string;
};

export function CommandCenterFooter({
  mode,
  deleteConfirmation,
  isRenamingAgent,
  selectedAgent,
  canCopySelectedTabUrl,
  canToggleSelectedTabPin,
  selectedTab,
  canToggleGitignored,
  includeGitignored,
  searchInContent,
}: {
  mode: CommandCenterMode;
  deleteConfirmation: CommandCenterDeleteConfirmation | null;
  isRenamingAgent: boolean;
  selectedAgent: AgentCommandItem | null;
  canCopySelectedTabUrl: boolean;
  canToggleSelectedTabPin: boolean;
  selectedTab: TabCommandItem | null;
  canToggleGitignored: boolean;
  includeGitignored: boolean;
  searchInContent: boolean;
}) {
  const { t } = useI18n();
  if (isRenamingAgent) {
    return (
      <div className="flex h-9 items-center justify-end gap-3 border-border-subtle border-t px-3 text-muted-foreground text-xs">
        <CommandCenterFooterAction label={t('common.cancel')}>
          <ShortcutCombo value="Esc" size="xs" />
        </CommandCenterFooterAction>
        <CommandCenterFooterAction label={t('common.save')}>
          <ShortcutCombo value="Enter" size="xs" />
        </CommandCenterFooterAction>
      </div>
    );
  }

  if (deleteConfirmation) {
    return (
      <div className="flex h-9 items-center justify-between gap-3 border-border-subtle border-t px-3 text-xs">
        <span className="min-w-0 truncate text-foreground">
          {t('commandCenter.footer.deleteConfirm').replace(
            '{title}',
            deleteConfirmation.title,
          )}
        </span>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
          <CommandCenterFooterAction label={t('common.cancel')}>
            <ShortcutCombo value="Esc" size="xs" />
          </CommandCenterFooterAction>
          <CommandCenterFooterAction label={t('common.delete')}>
            <ShortcutCombo value="Enter" size="xs" />
          </CommandCenterFooterAction>
        </div>
      </div>
    );
  }

  if (selectedAgent) {
    return (
      <div className="flex h-9 items-center justify-end gap-3 border-border-subtle border-t px-3 text-muted-foreground text-xs">
        <CommandCenterFooterAction label={t('common.rename')}>
          <HotkeyCombo
            action={HotkeyActions.COMMAND_CENTER_RENAME_AGENT}
            size="xs"
          />
        </CommandCenterFooterAction>
        <CommandCenterFooterAction
          label={
            selectedAgent.isPinned ? t('common.unpin') : t('common.pin')
          }
        >
          <HotkeyCombo
            action={HotkeyActions.COMMAND_CENTER_TOGGLE_AGENT_PIN}
            size="xs"
          />
        </CommandCenterFooterAction>
        {!selectedAgent.isWorking && (
          <CommandCenterFooterAction label={t('common.delete')}>
            <HotkeyCombo
              action={HotkeyActions.COMMAND_CENTER_DELETE_AGENT}
              size="xs"
            />
          </CommandCenterFooterAction>
        )}
      </div>
    );
  }

  if (mode === 'files') {
    return (
      <div className="flex h-9 items-center justify-end gap-3 border-border-subtle border-t px-3 text-muted-foreground text-xs">
        <CommandCenterFooterAction
          label={
            searchInContent
              ? t('commandCenter.footer.searchFilenamesOnly')
              : t('commandCenter.footer.searchInContent')
          }
        >
          <HotkeyCombo
            action={HotkeyActions.COMMAND_CENTER_TOGGLE_SEARCH_IN_CONTENT}
            size="xs"
          />
        </CommandCenterFooterAction>
        {canToggleGitignored && (
          <CommandCenterFooterAction
            label={
              includeGitignored
                ? t('commandCenter.footer.excludeGitignored')
                : t('commandCenter.footer.includeGitignored')
            }
          >
            <HotkeyCombo
              action={HotkeyActions.COMMAND_CENTER_TOGGLE_GITIGNORED}
              size="xs"
            />
          </CommandCenterFooterAction>
        )}
      </div>
    );
  }

  if (selectedTab) {
    return (
      <div className="flex h-9 items-center justify-end gap-3 border-border-subtle border-t px-3 text-muted-foreground text-xs">
        {canToggleSelectedTabPin && (
          <CommandCenterFooterAction
            label={selectedTab.isPinned ? t('common.unpin') : t('common.pin')}
          >
            <HotkeyCombo
              action={HotkeyActions.COMMAND_CENTER_TOGGLE_AGENT_PIN}
              size="xs"
            />
          </CommandCenterFooterAction>
        )}
        {canCopySelectedTabUrl && (
          <CommandCenterFooterAction label={t('commandCenter.footer.copyUrl')}>
            <HotkeyCombo
              action={HotkeyActions.COMMAND_CENTER_COPY_TAB_URL}
              size="xs"
            />
          </CommandCenterFooterAction>
        )}
        <CommandCenterFooterAction label={t('common.close')}>
          <HotkeyCombo action={HotkeyActions.CLOSE_TAB} size="xs" />
        </CommandCenterFooterAction>
      </div>
    );
  }

  return null;
}

function CommandCenterFooterAction({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <span>{label}</span>
    </span>
  );
}
