import type { ReactNode } from 'react';
import { useI18n } from '@ui/hooks/use-i18n';

export function CommandCenterOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('chat.cmdCenter.label')}
      data-command-center-modal-root=""
      className="app-no-drag fixed inset-0 z-100 flex items-start justify-center bg-overlay/55 p-6"
    >
      <button
        type="button"
        aria-label={t('chat.cmdCenter.close')}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative top-[calc((100vh-(44vh+2.5rem))/2)] z-10 w-[min(640px,calc(100vw-3rem))]">
        {children}
      </div>
    </div>
  );
}
