import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@ui/components/ui/logo';
import { useWindowFocused } from '@ui/hooks/use-window-focused';
import { cn } from '@ui/utils';
import { SplitText } from '@stagewise/stage-ui/components/split-text';
import type { StepValidityCallback } from '..';
import { useI18n } from '@ui/hooks/use-i18n';

export function StepWelcome({
  isActive,
  onValidityChange,
  onAnimationStart,
}: {
  isActive: boolean;
  onValidityChange: StepValidityCallback;
  onAnimationStart?: () => void;
}) {
  const { t } = useI18n();
  const welcomeLine1 = t('onboarding.welcome.line1');
  const welcomeLine2 = t('onboarding.welcome.line2');
  const [isComplete, setIsComplete] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showSecondLine, setShowSecondLine] = useState(false);

  const windowFocused = useWindowFocused();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isActive) onValidityChange(isComplete);
  }, [isComplete, isActive, onValidityChange]);

  // Wait for the window to be visible, then kick off both the orb and text.
  useEffect(() => {
    if (!windowFocused || hasStarted.current) return;
    const timer = setTimeout(() => {
      hasStarted.current = true;
      onAnimationStart?.();
      setShowText(true);
    }, 750);
    return () => clearTimeout(timer);
  }, [windowFocused, onAnimationStart]);

  const handleFirstLineComplete = useCallback(() => {
    const timer = setTimeout(() => setShowSecondLine(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const handleLastLineComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <Logo className="mb-4 size-16" />
      <div className="relative w-full text-center">
        <span className="invisible font-normal text-foreground text-lg">
          {welcomeLine1}
        </span>
        {showText && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SplitText
              text={welcomeLine1}
              className="font-normal text-foreground text-lg"
              delay={10}
              duration={0.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="0px"
              textAlign="center"
              tag="span"
              onLetterAnimationComplete={handleFirstLineComplete}
            />
          </div>
        )}
      </div>
      <div className="relative w-full text-center">
        <span className="invisible font-normal text-base text-primary-foreground">
          {welcomeLine2}
        </span>
        {showSecondLine && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SplitText
              text={welcomeLine2}
              className={cn('font-normal text-base text-primary-foreground')}
              delay={12}
              duration={0.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="0px"
              textAlign="center"
              tag="span"
              onLetterAnimationComplete={handleLastLineComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
