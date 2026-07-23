import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import { AgentStore } from '../../store/agent-store';
import { AgentHost } from '../../host/host';
import { DomainAdapterRegistry } from '../../env/contract';
import type { AgentSystemState } from '../../store/state';
import type { AgentHostModels } from '../../host/models';
import type { AgentHostTelemetry } from '../../host/telemetry';
import type { Logger } from '../../host/logger';
import type { HostPaths } from '../../host/paths';
import type { FileReadCacheService } from '../../services/file-read-cache';
import type { AttachmentsService } from '../../services/attachments';
import type {
  AgentMessage,
  AgentState,
  AgentTypes,
} from '../../types/agent';
import type { AgentStateMutations } from '../../services/agent-manager/state-mutations';
import { bindStateMutations } from '../../services/agent-manager/state-mutations/bind';
import {
  upsertAgentInstance,
  type AgentInstanceEnvelope,
} from '../../services/agent-manager/state-mutations/instances';
import { ChatAgent } from './chat';

class TestChatAgent extends ChatAgent {
  public exposeShouldAutoContinueGoal(): boolean {
    return this.shouldAutoContinueGoal();
  }

  public exposeAppendSyntheticContinuation(
    modelMessages: ModelMessage[],
  ): ModelMessage[] {
    return this.appendSyntheticContinuationIfNeeded(modelMessages);
  }

  public setSyntheticContinuationForTest(reason: 'goal-active'): void {
    this.setSyntheticContinuation(reason);
  }

  public startWatchdogForTest(
    stepGen: number,
    timeoutMs: number,
    checkIntervalMs: number,
  ): void {
    this.startStepActivityWatchdogForTest(
      stepGen,
      timeoutMs,
      checkIntervalMs,
    );
  }

  public stopWatchdogForTest(): void {
    this.stopStepActivityWatchdogForTest();
  }

  public isWatchdogRunningForTest(): boolean {
    return this.isStepActivityWatchdogRunning();
  }

  public markActivityForTest(now?: number): void {
    this.markStepActivityForTest(now);
  }

  public calculateActivityTimeoutForTest(args: {
    estimatedTokens: number;
    contextWindowTokens: number;
    providerMode?: 'stagewise' | 'official' | 'custom';
    providerOptions?: Record<string, unknown>;
    requestTimeoutMs?: number;
  }): number {
    return this.calculateStepActivityTimeoutForTest(args);
  }

  public runWithActivityHeartbeatForTest<T>(
    fn: () => Promise<T>,
    heartbeatMs: number,
  ): Promise<T> {
    return this.runWithStepActivityHeartbeatForTest(fn, heartbeatMs);
  }

  public getStepGenerationForWatchdogTest(): number {
    return this.getStepGenerationForTest();
  }

  public handleTimeoutForTest(): void {
    this.handleStepActivityTimeoutForTest(
      this.getStepGenerationForWatchdogTest(),
      100,
      false,
    );
  }

  public exposeGoalTools(): Partial<Record<string, unknown>> {
    return this.getGoalToolsForTest();
  }
}

function emptySystemState(): AgentSystemState {
  return { agents: { instances: {} }, toolbox: {} };
}

function makeLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function makePaths(): HostPaths {
  const root = 'C:\\tmp\\stagewise-agent-core-test';
  return {
    dataDir: () => root,
    tempDir: () => root,
    agentsDir: () => `${root}\\agents`,
    agentDir: (agentId) => `${root}\\agents\\${agentId}`,
    agentAttachmentsDir: (agentId) =>
      `${root}\\agents\\${agentId}\\attachments`,
    agentAttachmentPath: (agentId, attachmentId) =>
      `${root}\\agents\\${agentId}\\attachments\\${attachmentId}`,
    agentAppsDir: (agentId) => `${root}\\agents\\${agentId}\\apps`,
    agentShellLogsDir: (agentId) =>
      `${root}\\agents\\${agentId}\\shell-logs`,
    diffHistoryDir: () => `${root}\\diff-history`,
    diffHistoryDbPath: () => `${root}\\diff-history.sqlite`,
    diffHistoryBlobsDir: () => `${root}\\diff-history\\blobs`,
    agentDbPath: () => `${root}\\agents.sqlite`,
    fileReadCacheDbPath: () => `${root}\\file-read-cache.sqlite`,
    processedImageCacheDbPath: () => `${root}\\processed-image-cache.sqlite`,
    userDataDir: () => `${root}\\user-data`,
    plansDir: () => `${root}\\user-data\\plans`,
    logsDir: () => `${root}\\user-data\\logs`,
    memoryDir: () => `${root}\\user-data\\memory`,
    pluginsDir: () => `${root}\\plugins`,
    builtinSkillsDir: () => `${root}\\skills`,
    ripgrepBaseDir: () => `${root}\\ripgrep`,
  };
}

function makeHost(): AgentHost {
  return new AgentHost({
    paths: makePaths(),
    logger: makeLogger(),
    telemetry: {
      capture: () => {},
      captureException: () => {},
    } as AgentHostTelemetry,
    models: {
      getWithOptions: async () => ({
        model: {} as never,
        contextWindowSize: 200_000,
        providerOptions: {},
      }),
    } as AgentHostModels,
  });
}

function makeBaseState(): AgentState {
  return {
    title: '',
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
    type: ChatAgent.agentType as AgentTypes.CHAT,
    canSelectModel: true,
    requiredModelCapabilities: {},
    allowUserInput: true,
    parentAgentInstanceId: null,
    state,
  };
}

function makeAgent(state: AgentState): TestChatAgent {
  const store = new AgentStore(emptySystemState());
  upsertAgentInstance(store, 'a1', makeEnvelope(state));
  const getState = () => store.get().agents.instances.a1!.state;
  const commands: AgentStateMutations = bindStateMutations(store, 'a1');

  return new TestChatAgent({
    instanceId: 'a1',
    state: {
      get: getState,
      commands,
      persist: async () => {},
    },
    host: makeHost(),
    toolbox: {
      undoToolCalls: async () => {},
      drainPendingAttachments: () => [],
      cancelPendingAgentDialogs: () => {},
      clearAgentTracking: async () => {},
      getSkillsList: async () => [],
      getMountedPathsForAgent: () => new Map(),
      getTool: async () => null,
      handleMountWorkspace: async () => {},
      getWorkspaceMd: async () => [],
    },
    caches: {
      fileReadCache: {} as FileReadCacheService,
    },
    attachments: {} as AttachmentsService,
    domainAdapterRegistry: new DomainAdapterRegistry(makeLogger()),
    instanceConfig: undefined,
    initialState: state,
    spawnChildAgentHandler: async () => {
      throw new Error('not used');
    },
  });
}

describe('ChatAgent goal continuation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-continues a clean idle active goal', () => {
    const agent = makeAgent({
      ...makeBaseState(),
      goal: {
        id: 'goal-1',
        objective: 'finish the scan',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    });

    expect(agent.exposeShouldAutoContinueGoal()).toBe(true);
  });

  it('does not auto-continue terminal or paused goals', () => {
    for (const status of ['paused', 'complete', 'blocked'] as const) {
      const agent = makeAgent({
        ...makeBaseState(),
        goal: {
          id: `goal-${status}`,
          objective: 'finish the scan',
          status,
          createdAt: 1,
          updatedAt: 1,
        },
      });

      expect(agent.exposeShouldAutoContinueGoal()).toBe(false);
    }
  });

  it('does not auto-continue when waiting on an error or queued user input', () => {
    const errored = makeAgent({
      ...makeBaseState(),
      error: { message: 'provider failed' },
      goal: {
        id: 'goal-1',
        objective: 'finish the scan',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    });
    expect(errored.exposeShouldAutoContinueGoal()).toBe(false);

    const queued = makeAgent({
      ...makeBaseState(),
      queuedMessages: [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'new instruction' }],
          metadata: { createdAt: new Date(), partsMetadata: [] },
        } as AgentMessage & { role: 'user' },
      ],
      goal: {
        id: 'goal-1',
        objective: 'finish the scan',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    });
    expect(queued.exposeShouldAutoContinueGoal()).toBe(false);
  });

  it('keeps auto-continuing when cumulative tokens exceed a stored budget', () => {
    const budgeted = makeAgent({
      ...makeBaseState(),
      usedTokens: 100,
      goal: {
        id: 'goal-budget',
        objective: 'finish within budget',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
        tokenBudget: 100,
      },
    });

    expect(budgeted.exposeShouldAutoContinueGoal()).toBe(true);
  });

  it('injects a model-only continuation for active goals', () => {
    const agent = makeAgent(makeBaseState());

    agent.setSyntheticContinuationForTest('goal-active');
    const messages = agent.exposeAppendSyntheticContinuation([
      { role: 'assistant', content: 'partial result' },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ role: 'user' });
    expect(String(messages[1]!.content)).toContain(
      'Current goal is still active',
    );
  });

  it('does not expose goal tools before a goal exists', () => {
    const agent = makeAgent(makeBaseState());

    expect(agent.exposeGoalTools()).toEqual({});
  });

  it('exposes only inspect and update goal tools once a goal exists', () => {
    const agent = makeAgent({
      ...makeBaseState(),
      goal: {
        id: 'goal-1',
        objective: 'finish the scan',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const goalTools = agent.exposeGoalTools();
    expect(goalTools).toHaveProperty('getGoal');
    expect(goalTools).toHaveProperty('updateGoal');
    expect(goalTools).not.toHaveProperty('createGoal');
  });

  it('turns a silent stalled normal step into a visible runtime error', () => {
    vi.useFakeTimers();
    const state = { ...makeBaseState(), isWorking: true };
    const agent = makeAgent(state);

    agent.startWatchdogForTest(agent.getStepGenerationForWatchdogTest(), 100, 10);
    vi.advanceTimersByTime(110);

    expect(agent.isWatchdogRunningForTest()).toBe(false);
    expect(agent.state.get().isWorking).toBe(false);
    expect(agent.state.get().error?.message).toContain(
      'LLM stream stalled',
    );
  });

  it('clears a visible runtime phase when a preparation step stalls', () => {
    vi.useFakeTimers();
    const state = {
      ...makeBaseState(),
      isWorking: true,
      runtimePhase: 'preparing-context' as const,
    };
    const agent = makeAgent(state);

    agent.startWatchdogForTest(agent.getStepGenerationForWatchdogTest(), 100, 10);
    vi.advanceTimersByTime(110);

    expect(agent.state.get().isWorking).toBe(false);
    expect(agent.state.get().runtimePhase).toBeUndefined();
    expect(agent.state.get().error?.message).toContain(
      'LLM stream stalled',
    );
  });

  it('keeps the stalled-step watchdog alive while a long tool is running', async () => {
    vi.useFakeTimers();
    const state = { ...makeBaseState(), isWorking: true };
    const agent = makeAgent(state);
    let resolveTool!: (value: string) => void;
    const toolRun = new Promise<string>((resolve) => {
      resolveTool = resolve;
    });

    agent.startWatchdogForTest(agent.getStepGenerationForWatchdogTest(), 100, 10);
    const running = agent.runWithActivityHeartbeatForTest(() => toolRun, 50);
    await vi.advanceTimersByTimeAsync(240);

    expect(agent.isWatchdogRunningForTest()).toBe(true);
    expect(agent.state.get().error).toBeUndefined();

    resolveTool('done');
    await running;

    vi.advanceTimersByTime(110);
    expect(agent.isWatchdogRunningForTest()).toBe(false);
    expect(agent.state.get().error?.message).toContain(
      'LLM stream stalled',
    );
  });

  it('extends the silent-stream watchdog for large high-reasoning custom requests', () => {
    const agent = makeAgent(makeBaseState());

    expect(
      agent.calculateActivityTimeoutForTest({
        estimatedTokens: 322_000,
        contextWindowTokens: 1_000_000,
        providerMode: 'custom',
        providerOptions: {
          openai: { reasoningEffort: 'high' },
        },
      }),
    ).toBe(360_000);
  });

  it('recovers a silent stalled active goal instead of blocking it', () => {
    const state = {
      ...makeBaseState(),
      isWorking: true,
      goal: {
        id: 'goal-1',
        objective: 'keep going unattended',
        status: 'active' as const,
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const agent = makeAgent(state);

    agent.handleTimeoutForTest();
    const messages = agent.exposeAppendSyntheticContinuation([
      { role: 'assistant', content: 'stalled before finishing' },
    ]);

    expect(agent.state.get().isWorking).toBe(false);
    expect(agent.state.get().error).toBeUndefined();
    expect(agent.state.get().goal?.status).toBe('active');
    expect(String(messages[1]!.content)).toContain(
      'Current goal is still active',
    );
  });

  it('keeps the step alive when stream activity is observed', () => {
    vi.useFakeTimers();
    const state = { ...makeBaseState(), isWorking: true };
    const agent = makeAgent(state);

    agent.startWatchdogForTest(agent.getStepGenerationForWatchdogTest(), 100, 10);
    vi.advanceTimersByTime(90);
    agent.markActivityForTest(Date.now());
    vi.advanceTimersByTime(20);

    expect(agent.isWatchdogRunningForTest()).toBe(true);
    expect(agent.state.get().isWorking).toBe(true);
    expect(agent.state.get().error).toBeUndefined();

    agent.stopWatchdogForTest();
  });
});
