export const CHAT_GOAL_MODE_CHANGED_EVENT = 'chat-goal-mode-changed';

export type ChatGoalModeChangedEvent = CustomEvent<{
  agentId: string | null;
  enabled: boolean;
}>;

declare global {
  interface Window {
    __stagewiseGoalModeState?: { agentId: string | null; enabled: boolean };
  }
}
