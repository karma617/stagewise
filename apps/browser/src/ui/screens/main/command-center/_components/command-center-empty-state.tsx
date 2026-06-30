import { useI18n } from '@ui/hooks/use-i18n';

export function CommandCenterEmptyState({
  isLoading,
}: {
  isLoading?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="px-3 py-6 text-center text-muted-foreground text-xs">
      {isLoading
        ? t('commandCenter.empty.loading')
        : t('commandCenter.empty.noResults')}
    </div>
  );
}
