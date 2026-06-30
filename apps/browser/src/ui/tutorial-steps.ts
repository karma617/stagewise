import type { TutorialStep } from '@ui/contexts/tutorial';

interface TutorialContent {
  /**
   * Content version. Bump whenever steps are reordered, inserted, or
   * removed — persisted progress is keyed by id + version, so a bump
   * discards stale step indices instead of resuming at the wrong step.
   */
  version: number;
  steps: readonly TutorialStep[];
}

/**
 * All tutorials, keyed by id. Declaration order doubles as display
 * priority: when several tutorials queue up, earlier entries show first.
 *
 * Target convention: every `targetSelector` uses a `[data-tutorial="…"]`
 * attribute on the target element — never ids, classes, or aria-labels,
 * which change for unrelated reasons and break tutorials silently.
 */
export const TUTORIALS = {
  'general-ui-experience': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="chat-input"]',
        titleKey: 'tutorial.general.chatInput.title',
        descriptionKey: 'tutorial.general.chatInput.description',
      },
      {
        targetSelector: '[data-tutorial="connect-workspace"]',
        titleKey: 'tutorial.general.connectWorkspace.title',
        descriptionKey: 'tutorial.general.connectWorkspace.description',
      },
      {
        targetSelector: '[data-tutorial="new-tab-buttons"]',
        titleKey: 'tutorial.general.newTabButtons.title',
        descriptionKey: 'tutorial.general.newTabButtons.description',
      },
      {
        targetSelector: '[data-tutorial="sidebar-panel"]',
        titleKey: 'tutorial.general.sidebarPanel.title',
        descriptionKey: 'tutorial.general.sidebarPanel.description',
      },
      {
        targetSelector: '[data-tutorial="agent-card"]',
        titleKey: 'tutorial.general.agentCard.title',
        descriptionKey: 'tutorial.general.agentCard.description',
      },
    ],
  },

  'workspace-selection': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="workspace-badge"]',
        titleKey: 'tutorial.workspaceSelection.workspaceBadge.title',
        descriptionKey:
          'tutorial.workspaceSelection.workspaceBadge.description',
      },
      {
        targetSelector: '[data-tutorial="workspace-action-trigger"]',
        titleKey: 'tutorial.workspaceSelection.actionTrigger.title',
        descriptionKey: 'tutorial.workspaceSelection.actionTrigger.description',
      },
    ],
  },

  'workspace-selection-options': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="action-create-worktree"]',
        titleKey: 'tutorial.workspaceOptions.createWorktree.title',
        descriptionKey: 'tutorial.workspaceOptions.createWorktree.description',
      },
      {
        targetSelector: '[data-tutorial="action-switch-worktree"]',
        titleKey: 'tutorial.workspaceOptions.switchWorktree.title',
        descriptionKey: 'tutorial.workspaceOptions.switchWorktree.description',
      },
      {
        targetSelector: '[data-tutorial="action-create-branch"]',
        titleKey: 'tutorial.workspaceOptions.createBranch.title',
        descriptionKey: 'tutorial.workspaceOptions.createBranch.description',
      },
      {
        targetSelector: '[data-tutorial="action-switch-branch"]',
        titleKey: 'tutorial.workspaceOptions.switchBranch.title',
        descriptionKey: 'tutorial.workspaceOptions.switchBranch.description',
      },
    ],
  },

  'content-tabs': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="content-tab-item"]',
        titleKey: 'tutorial.contentTabs.openedTabs.title',
        descriptionKey: 'tutorial.contentTabs.openedTabs.description',
      },
    ],
  },

  'browser-element-selector': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="chat-element-selector"]',
        titleKey: 'tutorial.browserElementSelector.referenceElements.title',
        descriptionKey:
          'tutorial.browserElementSelector.referenceElements.description',
      },
    ],
  },

  'file-tree': {
    version: 1,
    steps: [
      {
        targetSelector: '[data-tutorial="file-tree-panel"]',
        titleKey: 'tutorial.fileTree.panel.title',
        descriptionKey: 'tutorial.fileTree.panel.description',
      },
      {
        targetSelector: '[data-tutorial="file-tree-workspace-tabs"]',
        titleKey: 'tutorial.fileTree.workspaceTabs.title',
        descriptionKey: 'tutorial.fileTree.workspaceTabs.description',
      },
    ],
  },
} as const satisfies Record<string, TutorialContent>;

export type TutorialId = keyof typeof TUTORIALS;

/** Display priority — index in declaration order; lower shows first. */
export const TUTORIAL_PRIORITY = Object.keys(
  TUTORIALS,
) as readonly TutorialId[];
