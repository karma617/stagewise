import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from '@stagewise/stage-ui/components/preview-card';
import type { TabState } from '@shared/karton-contracts/ui';
import { type ReactElement, useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { Button } from '@stagewise/stage-ui/components/button';
import { IconLinkFill18 } from 'nucleo-ui-fill-18';
import { useI18n } from '@ui/hooks/use-i18n';

export function WithTabPreviewCard({
  tabState,
  children,
  activeTabId,
}: {
  tabState: TabState;
  children: ReactElement;
  activeTabId: string | null | undefined;
}) {
  const { t } = useI18n();
  const isActive = tabState.id === activeTabId;
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [tabState.screenshot]);

  // Don't show preview for the currently active tab
  if (isActive) return children;

  return (
    <PreviewCard>
      <PreviewCardTrigger delay={1000} closeDelay={10} tabIndex={-1}>
        {children}
      </PreviewCardTrigger>
      <PreviewCardContent
        className="flex w-64 flex-col items-stretch gap-2"
        sideOffset={2}
      >
        {(tabState.screenshot?.length ?? 0) > 0 && (
          <>
            <img
              src={tabState.screenshot ?? undefined}
              className="hidden"
              alt={t('chat.preview.previewOfTab')}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
            {imageLoaded && (
              <div className="flex min-h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
                <img
                  src={tabState.screenshot ?? undefined}
                  className="max-h-36 max-w-full object-contain"
                  alt={t('chat.preview.previewOfTab')}
                />
              </div>
            )}
          </>
        )}
        <div className="flex flex-row items-start justify-between gap-2">
          <span className="mt-1 font-medium text-foreground text-xs">
            {tabState.title}
          </span>
          <div className="flex flex-row gap-0.5">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('chat.preview.copyCurrentUrl')}
                  onClick={() => navigator.clipboard.writeText(tabState.url)}
                >
                  <IconLinkFill18 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.preview.copyUrl')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
