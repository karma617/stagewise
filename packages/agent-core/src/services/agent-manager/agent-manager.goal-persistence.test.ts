import { describe, expect, it, vi } from 'vitest';
import { AgentTypeRegistry } from '../../agents/agents-registry';
import { CommandRegistry } from '../../commands/command-registry';
import { createTestAgentHost } from '../../host/test-utils';
import { AgentStore } from '../../store/agent-store';
import type { AgentSystemState } from '../../store/state';
import {
  AgentTypes,
  type AgentMessage,
  type AgentState,
} from '../../types/agent';
import { AgentManager } from './agent-manager';
import {
  upsertAgentInstance,
  type AgentInstanceEnvelope,
} from './state-mutations';

function emptySystemState(): AgentSystemState {
  return { agents: { instances: {} }, toolbox: {} };
}

function makeEnvelope(state: AgentState): AgentInstanceEnvelope {
  return {
    type: AgentTypes.CHAT,
    canSelectModel: true,
    requiredModelCapabilities: {},
    allowUserInput: true,
    parentAgentInstanceId: null,
    state,
  };
}

function makeMessage(id: string, role: 'user' | 'assistant'): AgentMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text: role, state: 'done' }],
    metadata: {
      createdAt: new Date('2026-07-19T00:00:00.000Z'),
      partsMetadata: [],
    },
  } as AgentMessage;
}

describe('AgentManager goal persistence', () => {
  it('restores a legacy completed goal from a newer updateGoal tool result', async () => {
    const completeGoal = {
      id: 'goal-1',
      objective: 'finish once',
      status: 'complete',
      createdAt: 1,
      updatedAt: 3,
      completedAt: 3,
      finalTokenUsage: 123,
    };
    const activeGoal = {
      ...completeGoal,
      status: 'active',
      updatedAt: 2,
      completedAt: undefined,
      finalTokenUsage: undefined,
    };
    const userMessage = {
      ...makeMessage('u1', 'user'),
      metadata: {
        ...makeMessage('u1', 'user').metadata!,
        goalSnapshot: activeGoal,
      },
    };
    const assistantMessage = {
      ...makeMessage('a1', 'assistant'),
      parts: [
        {
          type: 'tool-updateGoal',
          toolCallId: 'tc_1',
          state: 'output-available',
          input: { status: 'complete' },
          output: { ok: true, goal: completeGoal },
        },
      ],
    } as AgentMessage;
    const continueActiveGoal = vi.fn();
    const managerToolbox = {
      handleMountWorkspace: vi.fn(async () => {}),
      cancelQuestion: vi.fn(),
      getWorkspaceSnapshotForPersistence: vi.fn(() => []),
      setWorkspaceMdContent: vi.fn(),
      acceptAllPendingEditsForAgent: vi.fn(async () => {}),
      getEditedFilePathsForAgent: vi.fn(async () => []),
    };
    const manager = new AgentManager({
      host: createTestAgentHost({
        models: {
          has: vi.fn(() => true),
        } as any,
      }),
      commandRegistry: new CommandRegistry(),
      agentTypeRegistry: new AgentTypeRegistry(),
      startupPolicy: { kind: 'none' },
      state: { store: new AgentStore(emptySystemState()) },
      storage: {
        persistenceDb: {
          getStoredAgentInstanceById: vi.fn(async () => ({
            id: 'agent-1',
            type: AgentTypes.CHAT,
            instanceConfig: {},
            title: 'Goal chat',
            titleLockedByUser: false,
            activeModelId: 'model-1',
            toolApprovalMode: 'alwaysAsk',
            inputState: '',
            usedTokens: 123,
            queuedMessages: [],
            mountedWorkspaces: [],
            parentAgentInstanceId: null,
            history: [userMessage, assistantMessage],
          })),
          getLastChatModelId: vi.fn(async () => null),
        } as any,
        attachments: {} as any,
        fileReadCache: {} as any,
      },
      tools: {
        managerToolbox: managerToolbox as any,
        agentToolbox: managerToolbox as any,
      },
    });
    const createAgent = vi
      .spyOn(manager, 'createAgent')
      .mockResolvedValue({ continueActiveGoal } as any);

    await manager.resumeAgent('agent-1');

    expect(createAgent.mock.calls[0]![3]?.goal).toMatchObject({
      id: 'goal-1',
      status: 'complete',
    });
    expect(continueActiveGoal).not.toHaveBeenCalled();
    await manager.teardown();
  });

  it('marks the latest user message dirty when persisting a goal snapshot', async () => {
    const store = new AgentStore(emptySystemState());
    const userMessage = makeMessage('u1', 'user');
    const assistantMessage = makeMessage('a1', 'assistant');
    upsertAgentInstance(
      store,
      'agent-1',
      makeEnvelope({
        title: 'Goal chat',
        isWorking: false,
        history: [userMessage, assistantMessage],
        queuedMessages: [],
        activeModelId: 'model-1',
        toolApprovalMode: 'alwaysAsk',
        pendingApprovals: {},
        inputState: '',
        usedTokens: 123,
        goal: {
          id: 'goal-1',
          objective: 'finish once',
          status: 'complete',
          createdAt: 1,
          updatedAt: 2,
          completedAt: 2,
          finalTokenUsage: 123,
        },
      }),
    );

    const storeAgentInstance = vi.fn(async () => {});
    const managerToolbox = {
      handleMountWorkspace: vi.fn(async () => {}),
      cancelQuestion: vi.fn(),
      getWorkspaceSnapshotForPersistence: vi.fn(() => []),
      setWorkspaceMdContent: vi.fn(),
      acceptAllPendingEditsForAgent: vi.fn(async () => {}),
      getEditedFilePathsForAgent: vi.fn(async () => []),
    };
    const manager = new AgentManager({
      host: createTestAgentHost(),
      commandRegistry: new CommandRegistry(),
      agentTypeRegistry: new AgentTypeRegistry(),
      startupPolicy: { kind: 'none' },
      state: { store },
      storage: {
        persistenceDb: {
          storeAgentInstance,
          getLastChatModelId: vi.fn(async () => null),
        } as any,
        attachments: {} as any,
        fileReadCache: {} as any,
      },
      tools: {
        managerToolbox: managerToolbox as any,
        agentToolbox: managerToolbox as any,
      },
    });
    (manager as any).activeAgents.set('agent-1', {
      agentType: AgentTypes.CHAT,
      onTeardown: vi.fn(async () => {}),
    });

    await (manager as any).persistAgentState('agent-1');

    const [, history, dirtyMessageIndices] = storeAgentInstance.mock.calls[0]!;
    expect(dirtyMessageIndices).toContain(0);
    expect(history[0].metadata.goalSnapshot).toMatchObject({
      id: 'goal-1',
      status: 'complete',
    });
    await manager.teardown();
  });
});
