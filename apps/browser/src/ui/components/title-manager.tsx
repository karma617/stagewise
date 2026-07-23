import { useKartonState } from '@ui/hooks/use-karton';
import { useEffect } from 'react';
import { useI18n } from '@ui/hooks/use-i18n';

export function TitleManager() {
  const { t } = useI18n();
  const authStatus = useKartonState((s) => s.userAccount.status);

  useEffect(() => {
    if (authStatus === 'unauthenticated')
      document.title = t('common.signInTitle');
    else document.title = 'PickStar Studio';
  }, [authStatus]);

  return null;
}
