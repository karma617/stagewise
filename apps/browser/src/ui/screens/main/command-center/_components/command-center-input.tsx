import { forwardRef } from 'react';
import { IconMagnifierOutline18 } from 'nucleo-ui-outline-18';
import type { CommandCenterMode } from '../command-center-model';
import { CommandCenterModeToggle } from './command-center-mode-toggle';
import { useI18n } from '@ui/hooks/use-i18n';

export const CommandCenterInput = forwardRef<
  HTMLInputElement,
  {
    query: string;
    mode: CommandCenterMode;
    onQueryChange: (query: string) => void;
    onModeChange: (mode: CommandCenterMode) => void;
    onBlur: (input: HTMLInputElement) => void;
    onSelectionChange: (input: HTMLInputElement) => void;
  }
>(function CommandCenterInput(
  { query, mode, onBlur, onQueryChange, onModeChange, onSelectionChange },
  ref,
) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 border-border-subtle border-b px-3 py-2">
      <IconMagnifierOutline18 className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        value={query}
        onBlur={(event) => onBlur(event.currentTarget)}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={(event) => onSelectionChange(event.currentTarget)}
        onKeyUp={(event) => onSelectionChange(event.currentTarget)}
        onPointerUp={(event) => onSelectionChange(event.currentTarget)}
        onSelect={(event) => onSelectionChange(event.currentTarget)}
        placeholder={
          mode === 'files'
            ? t('commandCenter.search.placeholder.files')
            : t('commandCenter.search.placeholder.default')
        }
        className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-subtle-foreground"
      />
      <CommandCenterModeToggle mode={mode} onModeChange={onModeChange} />
    </div>
  );
});
