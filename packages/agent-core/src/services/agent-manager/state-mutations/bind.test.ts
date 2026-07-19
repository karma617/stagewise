import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../store/agent-store';
import type { AgentSystemState } from '../../../store/state';
import {
  AgentTypes,
  type AgentMessage,
  type AgentState,
} from '../../../types/agent';
import { bindStateMutations } from './bind';
import { upsertAgentInstance, type AgentInstanceEnvelope } from './instances';

function emptySystemState(): AgentSystemState {
  return { agents: { instances: {} }, toolbox: {} };
}

function minimalState(): AgentState {
  return {
    title: 'seed',
    isWorking: false,
    history: [],
    queuedMessages: [],
    activeModelId: 'model-1',
    toolApprovalMode: 'alwaysAsk',
    pendingApprovals: {},
    inputState: '',
    usedTokens: 0,
  };
}

function makeEnvelope(state: AgentState): AgentInstanceEnvelope {
  return {
    type: AgentTypes.CHAT,
    canSelectModel: true,
    requiredModelCapabilities: { foo: true } as unknown,
    allowUserInput: true,
    parentAgentInstanceId: null,
    state,
  };
}

describe('state-mutations/bind', () => {
  it('applies setTitle via the bound bundle', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));

    bindStateMutations(store, 'a1').setTitle({ title: 'renamed' });

    expect(store.get().agents.instances.a1?.state.title).toBe('renamed');
  });

  it('starts a goal via the bound bundle', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));

    bindStateMutations(store, 'a1').startGoal({
      id: 'goal-1',
      objective: 'finish the task',
      sourceMessageId: 'u1',
    });

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      objective: 'finish the task',
      status: 'active',
      sourceMessageId: 'u1',
    });
  });

  it('keeps the first goal when startGoal is called again', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
    mutations.startGoal({
      id: 'goal-2',
      objective: 'follow-up instruction',
      sourceMessageId: 'u2',
    });

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
  });

  it('pauses and resumes the current goal without blocking it', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
    mutations.pauseGoal();

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      status: 'paused',
      blockReason: undefined,
    });
    expect(
      store.get().agents.instances.a1?.state.goal?.pausedAt,
    ).toBeTypeOf('number');

    mutations.resumeGoal();

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      status: 'active',
      pausedAt: undefined,
    });
  });

  it('pauses a goal after the generic stop path marks it blocked', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
    mutations.setIsWorkingFalse();
    mutations.pauseGoal();

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      status: 'paused',
      blockedAt: undefined,
      blockReason: undefined,
    });
  });

  it('resumes a token-budget blocked goal and clears the stale budget', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
      tokenBudget: 100,
    });
    mutations.blockGoal({
      reason: 'Goal token budget reached (120/100).',
      finalTokenUsage: 120,
    });

    mutations.resumeGoal();

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      status: 'active',
      tokenBudget: undefined,
      blockedAt: undefined,
      blockReason: undefined,
      finalTokenUsage: undefined,
    });
  });

  it('can clear working state without blocking an active goal', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(
      store,
      'a1',
      makeEnvelope({ ...minimalState(), isWorking: true }),
    );
    const mutations = bindStateMutations(store, 'a1');

    mutations.setRuntimePhase({ phase: 'compressing-context' });

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
    mutations.setIsWorkingFalsePreserveGoal();

    expect(store.get().agents.instances.a1?.state.isWorking).toBe(false);
    expect(
      store.get().agents.instances.a1?.state.runtimePhase,
    ).toBeUndefined();
    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      status: 'active',
    });
    expect(
      store.get().agents.instances.a1?.state.goal?.blockedAt,
    ).toBeUndefined();
    expect(
      store.get().agents.instances.a1?.state.goal?.blockReason,
    ).toBeUndefined();
  });

  it('updates and clears runtime phase from the bound bundle', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.setRuntimePhase({ phase: 'compressing-context' });

    expect(store.get().agents.instances.a1?.state.runtimePhase).toBe(
      'compressing-context',
    );

    mutations.setRuntimePhase({ phase: undefined });

    expect(
      store.get().agents.instances.a1?.state.runtimePhase,
    ).toBeUndefined();
  });

  it('updates and deletes the current goal from the bound bundle', () => {
    const store = new AgentStore(emptySystemState());
    upsertAgentInstance(store, 'a1', makeEnvelope(minimalState()));
    const mutations = bindStateMutations(store, 'a1');

    mutations.startGoal({
      id: 'goal-1',
      objective: 'initial task',
      sourceMessageId: 'u1',
    });
    mutations.updateGoalObjective({ objective: '  edited task  ' });

    expect(store.get().agents.instances.a1?.state.goal).toMatchObject({
      id: 'goal-1',
      objective: 'edited task',
    });

    mutations.deleteGoal();

    expect(store.get().agents.instances.a1?.state.goal).toBeUndefined();
  });

  it('attachEnvState writes envState entries onto the target user message', () => {
    const store = new AgentStore(emptySystemState());
    const userMsg: AgentMessage = {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: 'hi', state: 'done' }],
      metadata: {
        createdAt: new Date(),
        partsMetadata: [],
      },
    };
    upsertAgentInstance(
      store,
      'a1',
      makeEnvelope({
        ...minimalState(),
        history: [userMsg],
      }),
    );

    bindStateMutations(store, 'a1').attachEnvState({
      entries: new Map([
        [
          'workspace',
          {
            schemaVersion: 1,
            state: { mounts: [] },
            renderedState: '<ws/>',
            renderedStateChange: '<ws-delta/>',
          },
        ],
      ]),
    });

    const hist = store.get().agents.instances.a1!.state.history[0]!;
    expect(hist.metadata?.envState).toEqual({
      workspace: {
        schemaVersion: 1,
        state: { mounts: [] },
        renderedState: '<ws/>',
        renderedStateChange: '<ws-delta/>',
      },
    });
  });

  it('attachEnvState merges with prior envState rather than replacing it', () => {
    const store = new AgentStore(emptySystemState());
    const userMsg: AgentMessage = {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: 'hi', state: 'done' }],
      metadata: {
        createdAt: new Date(),
        partsMetadata: [],
        envState: {
          workspace: {
            schemaVersion: 1,
            state: { mounts: [] },
            renderedState: 'ws-old',
            renderedStateChange: 'ws-old',
          },
        },
      },
    };
    upsertAgentInstance(
      store,
      'a1',
      makeEnvelope({
        ...minimalState(),
        history: [userMsg],
      }),
    );

    bindStateMutations(store, 'a1').attachEnvState({
      entries: new Map([
        [
          'browser',
          {
            schemaVersion: 1,
            state: { tabs: [] },
            renderedState: 'br',
            renderedStateChange: 'br',
          },
        ],
      ]),
    });

    const hist = store.get().agents.instances.a1!.state.history[0]!;
    expect(Object.keys(hist.metadata!.envState!).sort()).toEqual([
      'browser',
      'workspace',
    ]);
  });

  it('attachEnvState with empty entries is a no-op', () => {
    const store = new AgentStore(emptySystemState());
    const userMsg: AgentMessage = {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: 'hi', state: 'done' }],
      metadata: { createdAt: new Date(), partsMetadata: [] },
    };
    upsertAgentInstance(
      store,
      'a1',
      makeEnvelope({ ...minimalState(), history: [userMsg] }),
    );

    bindStateMutations(store, 'a1').attachEnvState({ entries: new Map() });

    const hist = store.get().agents.instances.a1!.state.history[0]!;
    expect(hist.metadata?.envState).toBeUndefined();
  });

  it('attaches cumulative usage summary to the last assistant message', () => {
    const store = new AgentStore(emptySystemState());
    const firstAssistant: AgentMessage = {
      id: 'a-prev',
      role: 'assistant',
      parts: [{ type: 'text', text: 'first', state: 'done' }],
      metadata: {
        createdAt: new Date(),
        partsMetadata: [],
        usageSummary: {
          totalTokens: 30,
          inputTokens: 20,
          outputTokens: 10,
          cachedInputTokens: 5,
          cacheWriteTokens: 2,
          contextTokens: 100,
          contextWindowTokens: 1000,
          modelCallCount: 1,
          durationMs: 1500,
        },
      },
    };
    const secondAssistant: AgentMessage = {
      id: 'a-next',
      role: 'assistant',
      parts: [{ type: 'text', text: 'second', state: 'done' }],
      metadata: { createdAt: new Date(), partsMetadata: [] },
    };
    upsertAgentInstance(
      store,
      'a1',
      makeEnvelope({
        ...minimalState(),
        history: [firstAssistant, secondAssistant],
      }),
    );

    bindStateMutations(store, 'a1').attachUsageSummaryToLastAssistant({
      totalTokens: 7,
      inputTokens: 5,
      outputTokens: 2,
      cachedInputTokens: 3,
      cacheWriteTokens: 1,
      contextTokens: 120,
      contextWindowTokens: 1000,
      durationMs: 2500,
    });

    const hist = store.get().agents.instances.a1!.state.history;
    expect(hist[1]?.metadata?.usageSummary).toEqual({
      totalTokens: 37,
      inputTokens: 25,
      outputTokens: 12,
      cachedInputTokens: 8,
      cacheWriteTokens: 3,
      contextTokens: 120,
      contextWindowTokens: 1000,
      modelCallCount: 2,
      durationMs: 4000,
    });
  });
});
