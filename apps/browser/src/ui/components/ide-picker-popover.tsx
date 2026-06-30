import { useMemo, type ReactElement } from 'react';
import { Select, type SelectItem } from '@stagewise/stage-ui/components/select';
import { IdeLogo } from '@ui/components/ide-logo';
import { IDE_SELECTION_ITEMS } from '@ui/utils';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';
import { useI18n } from '@ui/hooks/use-i18n';

export function IdePickerPopover({
  children,
  onSelect,
}: {
  children: ReactElement;
  onSelect: (ide: OpenFilesInIde) => void;
}) {
  const { t } = useI18n();
  const items: SelectItem<OpenFilesInIde>[] = useMemo(
    () => [
      { value: 'cursor', label: 'Cursor', group: t('fileTree.openFilesIn') },
      { value: 'vscode', label: 'VS Code', group: t('fileTree.openFilesIn') },
      { value: 'zed', label: 'Zed', group: t('fileTree.openFilesIn') },
      { value: 'kiro', label: 'Kiro', group: t('fileTree.openFilesIn') },
      { value: 'windsurf', label: 'Windsurf', group: t('fileTree.openFilesIn') },
      { value: 'trae', label: 'Trae', group: t('fileTree.openFilesIn') },
      {
        value: 'other',
        label: IDE_SELECTION_ITEMS.other,
        group: t('fileTree.openFilesIn'),
      },
    ],
    [t],
  );

  const itemsWithIcons: SelectItem<OpenFilesInIde>[] = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        icon: <IdeLogo ide={item.value} className="size-4" />,
      })),
    [items],
  );

  return (
    <Select<OpenFilesInIde>
      items={itemsWithIcons}
      onValueChange={(value) => onSelect(value)}
      placeholder={t('common.openFilesIn')}
      size="xs"
      side="top"
      sideOffset={6}
      align="start"
      showItemIndicator={false}
      customTrigger={(triggerProps) => (
        <button type="button" {...triggerProps}>
          {children}
        </button>
      )}
    />
  );
}
