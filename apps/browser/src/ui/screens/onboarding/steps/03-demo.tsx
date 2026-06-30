import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WorkspacesDark,
  WorkspacesLight,
  DesignPreviewDark,
  DesignPreviewLight,
  PluginsDark,
  PluginsLight,
  MentionsDark,
  MentionsLight,
  CommandsAndSkillsDark,
  CommandsAndSkillsLight,
} from '@ui/assets/feature-images';
import { useTrack } from '@ui/hooks/use-track';
import { cn } from '@ui/utils';
import { useI18n } from '@ui/hooks/use-i18n';

interface Slide {
  headingKey: string;
  previewHeadingKey: string;
  subtitleKey: string;
  light: string;
  dark: string;
}

const slides: Slide[] = [
  {
    headingKey: 'onboarding.demo.workspaces.heading',
    previewHeadingKey: 'onboarding.demo.workspaces.preview',
    subtitleKey: 'onboarding.demo.workspaces.subtitle',
    light: WorkspacesLight,
    dark: WorkspacesDark,
  },
  {
    headingKey: 'onboarding.demo.commands.heading',
    previewHeadingKey: 'onboarding.demo.commands.preview',
    subtitleKey: 'onboarding.demo.commands.subtitle',
    light: CommandsAndSkillsLight,
    dark: CommandsAndSkillsDark,
  },
  {
    headingKey: 'onboarding.demo.mentions.heading',
    previewHeadingKey: 'onboarding.demo.mentions.preview',
    subtitleKey: 'onboarding.demo.mentions.subtitle',
    light: MentionsLight,
    dark: MentionsDark,
  },
  {
    headingKey: 'onboarding.demo.designPreviews.heading',
    previewHeadingKey: 'onboarding.demo.designPreviews.preview',
    subtitleKey: 'onboarding.demo.designPreviews.subtitle',
    light: DesignPreviewLight,
    dark: DesignPreviewDark,
  },
  {
    headingKey: 'onboarding.demo.plugins.heading',
    previewHeadingKey: 'onboarding.demo.plugins.preview',
    subtitleKey: 'onboarding.demo.plugins.subtitle',
    light: PluginsLight,
    dark: PluginsDark,
  },
];

const SLIDE_INTERVAL = 6500;
const FADE_DURATION = 200;

export function StepDemo() {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const track = useTrack();

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    timerRef.current = null;
    fadeRef.current = null;
  }, []);

  /** Transition to next/prev index, optionally resuming auto-play. */
  const transitionTo = useCallback(
    (getNext: (prev: number) => number, resumeAutoPlay: boolean) => {
      clearTimers();
      setVisible(false);
      fadeRef.current = setTimeout(() => {
        fadeRef.current = null;
        setActiveIndex(getNext);
        setSlideKey((k) => k + 1);
        setVisible(true);
        if (resumeAutoPlay && !pausedRef.current) {
          timerRef.current = setInterval(
            () => transitionTo((p) => (p + 1) % slides.length, true),
            SLIDE_INTERVAL,
          );
        }
      }, FADE_DURATION);
    },
    [clearTimers],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      pause();
      track('onboarding-demo-slide-clicked', {
        slide_name: slides[index]?.previewHeadingKey ?? `slide-${index}`,
      });
      transitionTo(() => index, false);
    },
    [activeIndex, pause, track, transitionTo],
  );

  useEffect(() => {
    timerRef.current = setInterval(
      () => transitionTo((p) => (p + 1) % slides.length, true),
      SLIDE_INTERVAL,
    );
    return clearTimers;
  }, [transitionTo, clearTimers]);

  const slide = slides[activeIndex];

  if (!slide) return null;

  return (
    <div className="flex flex-1 items-center justify-center gap-0">
      <div
        className={cn(
          'flex w-fit flex-col items-center transition-opacity',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${FADE_DURATION}ms` }}
      >
        <h1 className="font-semibold text-2xl text-foreground">
          {t(slide.headingKey)}
        </h1>
        <p className="pt-1 text-muted-foreground text-sm">{t(slide.subtitleKey)}</p>
        <div className="flex w-1/2 flex-col gap-2 pt-4">
          <img
            src={slide.light}
            alt={t(slide.headingKey)}
            className="block h-auto w-full rounded-md border border-border-subtle dark:hidden"
          />
          <img
            src={slide.dark}
            alt={t(slide.headingKey)}
            className="hidden h-auto w-full rounded-md border border-border-subtle dark:block"
          />
          <SlideIndicators
            slides={slides}
            activeIndex={activeIndex}
            slideKey={slideKey}
            animationDuration={SLIDE_INTERVAL}
            paused={paused}
            onGoTo={goTo}
          />
        </div>
      </div>
    </div>
  );
}

function SlideIndicators({
  slides,
  activeIndex,
  slideKey,
  animationDuration,
  paused,
  onGoTo,
}: {
  slides: Slide[];
  activeIndex: number;
  slideKey: number;
  animationDuration: number;
  paused: boolean;
  onGoTo: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid w-full grid-cols-5 gap-2 pt-8">
      <style>
        {`@keyframes indicator-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }`}
      </style>
      {slides.map((slide, index) => {
        const isCurrent = index === activeIndex;
        return (
          <button
            type="button"
            key={`slide-btn-${index}`}
            onClick={() => onGoTo(index)}
            className={cn(
              'app-no-drag relative cursor-pointer overflow-hidden rounded-md px-2 py-1.5',
              'text-center font-medium text-xs leading-tight',
              'transition-colors duration-150',
              isCurrent
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80',
              'bg-background/l-4_c-2 dark:bg-background/l12_cx0.9',
            )}
          >
            {/* Progress fill layer — only on active slide */}
            {isCurrent && (
              <div
                key={slideKey}
                className="absolute inset-0 bg-background/l-12_c-2 dark:bg-background/l22_cx0.9"
                style={
                  paused
                    ? undefined
                    : {
                        transformOrigin: 'left',
                        animation: `indicator-fill ${animationDuration}ms linear forwards`,
                      }
                }
              />
            )}
            {/* Label on top of fill */}
            <span className="relative z-10">{t(slide.previewHeadingKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
