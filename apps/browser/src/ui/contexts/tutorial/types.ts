export interface TutorialStep {
  /** CSS selector for the DOM element to highlight */
  targetSelector: string;
  /** i18n key for the step title shown in the popover */
  titleKey: string;
  /** i18n key for the step description in markdown format */
  descriptionKey: string;
}

export interface TutorialDefinition {
  /** Unique identifier for this tutorial (e.g. "command-center") */
  id: string;
  /**
   * Content version. Persisted progress is keyed by id + version, so bump
   * this whenever steps are reordered, inserted, or removed — otherwise
   * users with stale step indices would resume at the wrong step.
   */
  version: number;
  /** Ordered list of steps */
  steps: readonly TutorialStep[];
  /**
   * Display priority when multiple tutorials are queued.
   * Lower values are shown first. Defaults to lowest priority.
   */
  priority?: number;
}
