import type { AgentStore } from '../../../store/agent-store';
import type { AgentState } from '../../../types/agent';
import { updateAgentInstanceState } from './internal';

export function syncGoalSnapshotToLastUserMessage(
  state: AgentState,
): number | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const message = state.history[i];
    if (!message || message.role !== 'user') continue;

    const metadata = message.metadata ?? {
      createdAt: new Date(),
      partsMetadata: [],
    };

    message.metadata = {
      ...metadata,
      goalSnapshot: state.goal ? { ...state.goal } : null,
    };
    return i;
  }
  return undefined;
}

const GOAL_TOKEN_BUDGET_BLOCK_PREFIX = 'Goal token budget reached';

function isGoalTokenBudgetBlockReason(reason: string | undefined): boolean {
  return reason?.startsWith(GOAL_TOKEN_BUDGET_BLOCK_PREFIX) === true;
}

/**
 * Bucket A — trivial single-field setters. Each wraps exactly one
 * `store.update()` and is a defensive no-op on missing agent ids. Kept
 * inside the `state-mutations/` folder so every per-instance write
 * lives behind the same surface as the more complex transforms.
 */

export function setTitle(
  store: AgentStore,
  agentInstanceId: string,
  args: { title: string },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.title = args.title;
  });
}

export function setUserTitle(
  store: AgentStore,
  agentInstanceId: string,
  args: { title: string },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.title = args.title;
    state.titleLockedByUser = true;
  });
}

export function setInputState(
  store: AgentStore,
  agentInstanceId: string,
  args: { inputState: string },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.inputState = args.inputState;
  });
}

export function setActiveModel(
  store: AgentStore,
  agentInstanceId: string,
  args: { modelId: AgentState['activeModelId'] },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.activeModelId = args.modelId;
  });
}

export function setIsWorkingFalse(
  store: AgentStore,
  agentInstanceId: string,
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.isWorking = false;
    state.runtimePhase = undefined;
    if (state.goal?.status === 'active') {
      const now = Date.now();
      state.goal.status = 'blocked';
      state.goal.updatedAt = now;
      state.goal.blockedAt = now;
      state.goal.blockReason = 'Agent stopped before the goal was completed.';
      state.goal.finalTokenUsage = state.usedTokens;
      syncGoalSnapshotToLastUserMessage(state);
    }
  });
}

export function setIsWorkingFalsePreserveGoal(
  store: AgentStore,
  agentInstanceId: string,
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.isWorking = false;
    state.runtimePhase = undefined;
  });
}

export function pauseGoal(store: AgentStore, agentInstanceId: string): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (!state.goal) return;
    if (state.goal.status !== 'active' && state.goal.status !== 'blocked') {
      return;
    }

    const now = Date.now();
    state.goal.status = 'paused';
    state.goal.updatedAt = now;
    state.goal.pausedAt = now;
    state.goal.blockedAt = undefined;
    state.goal.blockReason = undefined;
    state.goal.finalTokenUsage = undefined;
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function resumeGoal(store: AgentStore, agentInstanceId: string): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (
      !state.goal ||
      (state.goal.status !== 'paused' && state.goal.status !== 'blocked')
    ) {
      return;
    }

    const wasTokenBudgetBlock = isGoalTokenBudgetBlockReason(
      state.goal.blockReason,
    );

    state.goal.status = 'active';
    state.goal.updatedAt = Date.now();
    state.goal.pausedAt = undefined;
    state.goal.blockedAt = undefined;
    state.goal.blockReason = undefined;
    state.goal.finalTokenUsage = undefined;
    if (wasTokenBudgetBlock) {
      state.goal.tokenBudget = undefined;
    }
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function updateGoalObjective(
  store: AgentStore,
  agentInstanceId: string,
  args: { objective: string },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (!state.goal) return;

    const objective = args.objective.trim();
    if (!objective) return;

    state.goal.objective = objective;
    state.goal.updatedAt = Date.now();
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function deleteGoal(store: AgentStore, agentInstanceId: string): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.goal = undefined;
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function setUsageWarning(
  store: AgentStore,
  agentInstanceId: string,
  args: {
    warning:
      | { windowType: string; usedPercent: number; resetsAt: string }
      | undefined;
  },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.usageWarning = args.warning;
  });
}

export function startGoal(
  store: AgentStore,
  agentInstanceId: string,
  args: {
    id: string;
    objective: string;
    sourceMessageId?: string;
    tokenBudget?: number;
  },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (state.goal) return;

    const now = Date.now();
    state.goal = {
      id: args.id,
      objective: args.objective,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      sourceMessageId: args.sourceMessageId,
      tokenBudget: args.tokenBudget,
    };
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function completeGoal(
  store: AgentStore,
  agentInstanceId: string,
  args?: { finalTokenUsage?: number },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (!state.goal || state.goal.status !== 'active') return;
    const now = Date.now();
    state.goal.status = 'complete';
    state.goal.updatedAt = now;
    state.goal.completedAt = now;
    state.goal.finalTokenUsage = args?.finalTokenUsage ?? state.usedTokens;
    state.goal.pausedAt = undefined;
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function blockGoal(
  store: AgentStore,
  agentInstanceId: string,
  args: { reason: string; finalTokenUsage?: number },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    if (!state.goal || state.goal.status !== 'active') return;
    const now = Date.now();
    state.goal.status = 'blocked';
    state.goal.updatedAt = now;
    state.goal.blockedAt = now;
    state.goal.blockReason = args.reason;
    state.goal.finalTokenUsage = args.finalTokenUsage ?? state.usedTokens;
    state.goal.pausedAt = undefined;
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function clearGoal(store: AgentStore, agentInstanceId: string): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.goal = undefined;
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function syncGoalSnapshot(
  store: AgentStore,
  agentInstanceId: string,
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    syncGoalSnapshotToLastUserMessage(state);
  });
}

export function recordUsage(
  store: AgentStore,
  agentInstanceId: string,
  args: { totalTokens: number },
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.usedTokens = args.totalTokens;
  });
}
