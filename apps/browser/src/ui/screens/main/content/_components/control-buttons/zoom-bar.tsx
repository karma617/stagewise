import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import {
  IconMagnifierMinusOutline18,
  IconMagnifierPlusOutline18,
} from 'nucleo-ui-outline-18';
import { HotkeyCombo } from '@ui/components/hotkey-combo';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { HotkeyActions } from '@shared/hotkeys';
import { useI18n } from '@ui/hooks/use-i18n';

interface ZoomBarProps {
  tabId: string;
}

export function ZoomBar({
  tabId }: ZoomBarProps) {
  const { t } = useI18n();
  const zoomPercentage = useKartonState(
    (s) => s.contentTabs.tabs[tabId]?.zoomPercentage ?? 100,
  );
  const setZoomPercentage = useKartonProcedure(
    (p) => p.browser.setZoomPercentage,
  );

  const [isHovered, setIsHovered] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const zoomOut = useCallback(() => {
    if (zoomPercentage <= 50) {
      return;
    }
    setZoomPercentage(zoomPercentage - 10, tabId);
  }, [zoomPercentage, setZoomPercentage, tabId]);

  const zoomIn = useCallback(() => {
    if (zoomPercentage >= 500) {
      return;
    }
    setZoomPercentage(zoomPercentage + 10, tabId);
  }, [zoomPercentage, setZoomPercentage, tabId]);

  const resetZoom = useCallback(() => {
    setZoomPercentage(100, tabId);
  }, [setZoomPercentage, tabId]);

  // Handle auto-hide logic
  useEffect(() => {
    // Clear any existing timers
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    // Show if zoom is not 100%
    if (zoomPercentage !== 100) {
      if (!shouldShow) {
        // Component is not showing, animate in
        setShouldShow(true);
      }
      return;
    }

    // If zoom is 100% and mouse is not hovering, start hide timer
    if (zoomPercentage === 100 && !isHovered) {
      hideTimerRef.current = setTimeout(() => {
        setShouldShow(false);
      }, 1500);
    }

    // Cleanup timers on unmount
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [zoomPercentage, isHovered, shouldShow]);

  // Note: The previous useEffect that reset on activeTabId change is no longer needed
  // because each tab now has its own ZoomBar instance with isolated state

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!shouldShow) {
      setShouldShow(true);
    }
  }, [shouldShow]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  if (zoomPercentage === 100 && !shouldShow) {
    return null;
  }

  if (!shouldShow) return null;

  return (
    <div
      className="flex h-full flex-row items-center gap-0 px-1.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-row items-center gap-0">
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('common.zoomOut')}
              onClick={zoomOut}
            >
              <IconMagnifierMinusOutline18 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex items-center gap-1.5">
              <span>{t('common.zoomOut')}</span>
              <HotkeyCombo action={HotkeyActions.ZOOM_OUT} size="xs" />
            </span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="xs" onClick={resetZoom}>
              {zoomPercentage}%
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex items-center gap-1.5">
              <span>{t('common.resetZoom')}</span>
              <HotkeyCombo action={HotkeyActions.ZOOM_RESET} size="xs" />
            </span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('common.zoomIn')}
              onClick={zoomIn}
            >
              <IconMagnifierPlusOutline18 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex items-center gap-1.5">
              <span>{t('common.zoomIn')}</span>
              <HotkeyCombo action={HotkeyActions.ZOOM_IN} size="xs" />
            </span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
