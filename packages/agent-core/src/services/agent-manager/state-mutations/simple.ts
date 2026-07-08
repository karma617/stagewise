import type { AgentStore } from '../../../store/agent-store';
import type { AgentState } from '../../../types/agent';
import { updateAgentInstanceState } from './internal';

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
    if (state.goal?.status === 'active') {
      const now = Date.now();
      state.goal.status = 'blocked';
      state.goal.updatedAt = now;
      state.goal.blockedAt = now;
      state.goal.blockReason = 'Agent stopped before the goal was completed.';
      state.goal.finalTokenUsage = state.usedTokens;
    }
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
  });
}

export function clearGoal(
  store: AgentStore,
  agentInstanceId: string,
): void {
  updateAgentInstanceState(store, agentInstanceId, (state) => {
    state.goal = undefined;
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
