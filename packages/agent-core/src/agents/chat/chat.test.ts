import { jsonSchema, type ModelMessage, type ToolSet } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createTestAgentHost } from '../../host/test-utils';
import type { AgentMessage } from '../../types/agent';
import { getLastCompressionBaselineUsedTokens } from '../base-agent';
import { ChatAgent } from './chat';

/**
 * Tests for {@link ChatAgent}'s tool-resolution contract.
 *
 * `ChatAgent` is the host-agnostic baseline: it must only request the
 * universal file-ops + `updateWorkspaceMd` spawn tool from its toolbox.
 * Host-specific tools (browser, shell, sandbox, ...) arrive via the
 * `getAdditionalTools` template hook, which subclasses override.
 *
 * We bypass `BaseAgent`'s heavy constructor here by stubbing the few
 * fields `getTools` actually touches (`instanceId`, `toolbox`,
 * `getSpawnChildAgentTool`). This keeps the test focused on the
 * contract without re-instantiating the whole agent runtime.
 */

interface ChatAgentInternals {
  instanceId: string;
  toolbox: { getTool: ReturnType<typeof vi.fn> };
  host: { workspaceMdRelativePath: () => string };
  getSpawnChildAgentTool: () => unknown;
  getTools: () => Promise<Record<string, unknown>>;
  getAdditionalTools: () => Promise<Record<string, unknown>>;
}

function makeStubAgent<T extends ChatAgent>(
  ctor: new (...args: never[]) => T,
  toolboxImpl: { getTool: ReturnType<typeof vi.fn> },
): ChatAgentInternals {
  const instance = Object.create(ctor.prototype) as ChatAgentInternals;
  instance.instanceId = 'test-agent';
  instance.toolbox = toolboxImpl;
  // Use a default-configured AgentHost so the tool-description path
  // reads `workspaceMdRelativePath()` without ceremony.
  instance.host = createTestAgentHost();
  instance.getSpawnChildAgentTool = () => ({ kind: 'spawn-child' });
  return instance;
}

describe('ChatAgent', () => {
  it('getAdditionalTools defaults to an empty record', async () => {
    const stub = makeStubAgent(ChatAgent, {
      getTool: vi.fn().mockResolvedValue({}),
    });
    const extra = await stub.getAdditionalTools();
    expect(extra).toEqual({});
  });

  it('getTools returns only universal file ops + updateWorkspaceMd', async () => {
    const getTool = vi.fn().mockResolvedValue({});
    const stub = makeStubAgent(ChatAgent, { getTool });
    const tools = await stub.getTools();

    expect(Object.keys(tools).sort()).toEqual([
      'copy',
      'delete',
      'glob',
      'grepSearch',
      'multiEdit',
      'read',
      'updateWorkspaceMd',
      'write',
    ]);
  });

  it('getTools never requests host-specific tools from the toolbox', async () => {
    const getTool = vi.fn().mockResolvedValue({});
    const stub = makeStubAgent(ChatAgent, { getTool });
    await stub.getTools();

    const requestedNames = getTool.mock.calls.map(([name]) => name);
    expect(requestedNames).not.toContain('executeSandboxJs');
    expect(requestedNames).not.toContain('executeShellCommand');
    expect(requestedNames).not.toContain('listLibraryDocs');
    expect(requestedNames).not.toContain('searchInLibraryDocs');
    expect(requestedNames).not.toContain('getLintingDiagnostics');
    expect(requestedNames).not.toContain('readConsoleLogs');
    expect(requestedNames).not.toContain('askUserQuestions');
  });

  it('getTools filters out null entries returned by the toolbox', async () => {
    const getTool = vi
      .fn()
      .mockImplementation(async (name: string) =>
        name === 'delete' || name === 'copy' ? null : {},
      );
    const stub = makeStubAgent(ChatAgent, { getTool });
    const tools = await stub.getTools();

    expect(tools).not.toHaveProperty('delete');
    expect(tools).not.toHaveProperty('copy');
    expect(tools).toHaveProperty('read');
    expect(tools).toHaveProperty('write');
    expect(tools).toHaveProperty('updateWorkspaceMd');
  });

  it('subclass overrides of getAdditionalTools are merged into getTools', async () => {
    class SubChatAgent extends ChatAgent {
      protected async getAdditionalTools(): Promise<Record<string, unknown>> {
        return {
          customHostTool: { kind: 'host-tool' },
        } as Record<string, never>;
      }
    }
    const getTool = vi.fn().mockResolvedValue({});
    const stub = makeStubAgent(SubChatAgent, { getTool });
    const tools = await stub.getTools();

    expect(tools).toHaveProperty('customHostTool');
    expect(tools.read).toBeDefined();
  });

  it('subclass-provided null entries are filtered out alongside baseline nulls', async () => {
    class SubChatAgent extends ChatAgent {
      protected async getAdditionalTools(): Promise<Record<string, unknown>> {
        return {
          missingHostTool: null,
          presentHostTool: { kind: 'host-tool' },
        } as Record<string, never>;
      }
    }
    const getTool = vi.fn().mockResolvedValue({});
    const stub = makeStubAgent(SubChatAgent, { getTool });
    const tools = await stub.getTools();

    expect(tools).not.toHaveProperty('missingHostTool');
    expect(tools).toHaveProperty('presentHostTool');
  });
});


describe('ChatAgent context-window error detection', () => {
  function makeError(message: string, responseBody?: string): Error {
    const error = new Error(message) as Error & { responseBody?: string };
    if (responseBody !== undefined) error.responseBody = responseBody;
    return error;
  }

  it('detects prompt-length errors hidden behind a generic upstream 400', () => {
    const stub = makeStubAgent(ChatAgent, {
      getTool: vi.fn().mockResolvedValue({}),
    }) as ChatAgentInternals & {
      isContextWindowExceededError: (error: Error) => boolean;
    };

    const error = makeError(
      'Upstream error: 400',
      JSON.stringify({
        code: 'invalid-argument',
        error:
          "This model's maximum prompt length is 500000 but the request contains 508279 tokens.",
      }),
    );

    expect(stub.isContextWindowExceededError(error)).toBe(true);
  });

  it('does not treat unrelated upstream 400 errors as context overflow', () => {
    const stub = makeStubAgent(ChatAgent, {
      getTool: vi.fn().mockResolvedValue({}),
    }) as ChatAgentInternals & {
      isContextWindowExceededError: (error: Error) => boolean;
    };

    const error = makeError(
      'Upstream error: 400',
      JSON.stringify({ error: 'Bad request: malformed tool payload' }),
    );

    expect(stub.isContextWindowExceededError(error)).toBe(false);
  });
});


describe('ChatAgent context preflight estimation', () => {
  it('does not let legacy compressed history suppress preflight compression', () => {
    const history = [
      {
        id: 'legacy-boundary',
        role: 'assistant',
        parts: [],
        metadata: {
          compressedHistory: 'legacy summary without compressionState',
        },
      },
    ] as unknown as AgentMessage[];

    expect(getLastCompressionBaselineUsedTokens(history, 500_000)).toBe(0);
  });

  it('keeps compression checkpoints as the active token baseline', () => {
    const history = [
      {
        id: 'boundary',
        role: 'assistant',
        parts: [],
        metadata: {
          compressedHistory: 'summary',
          compressionState: {
            baselineUsedTokens: 123_456,
            compressedAt: 1,
          },
        },
      },
    ] as unknown as AgentMessage[];

    expect(getLastCompressionBaselineUsedTokens(history, 500_000)).toBe(
      123_456,
    );
  });



  it('resolves context window through the current agent instance', async () => {
    const getWithOptions = vi.fn().mockResolvedValue({
      contextWindowSize: 480_000,
    });
    const stub = makeStubAgent(ChatAgent, {
      getTool: vi.fn().mockResolvedValue({}),
    }) as ChatAgentInternals & {
      state: { get: () => { activeModelId: string } };
      host: {
        workspaceMdRelativePath: () => string;
        models: { getWithOptions: typeof getWithOptions };
      };
      getActiveContextWindowSize: () => Promise<number>;
    };
    stub.instanceId = 'agent-instance-123';
    stub.state = {
      get: () => ({ activeModelId: 'opus-4-8-high' }),
    };
    stub.host = {
      ...stub.host,
      models: { getWithOptions },
    };

    await expect(stub.getActiveContextWindowSize()).resolves.toBe(480_000);
    expect(getWithOptions).toHaveBeenCalledWith(
      'opus-4-8-high',
      'agent-instance-123',
      expect.objectContaining({
        $model_request_purpose: 'agent-step',
      }),
    );
  });

  it('includes serialized tool schemas in final request token estimates', async () => {
    const stub = makeStubAgent(ChatAgent, {
      getTool: vi.fn().mockResolvedValue({}),
    }) as ChatAgentInternals & {
      estimateFinalRequestTokens: (
        modelMessages: ModelMessage[],
        tools: Partial<ToolSet>,
      ) => Promise<number>;
      estimateModelMessagesTokens: (modelMessages: ModelMessage[]) => number;
    };
    const modelMessages = [
      {
        role: 'user',
        content: 'short prompt',
      },
    ] as ModelMessage[];
    const messageEstimate = stub.estimateModelMessagesTokens(modelMessages);
    const tools = {
      largeSchemaTool: {
        description: 'large tool used to verify final request preflight',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            payload: {
              type: 'string',
              description: 'x'.repeat(8000),
            },
          },
          required: ['payload'],
          additionalProperties: false,
        }),
      },
    } as Partial<ToolSet>;

    const finalEstimate = await stub.estimateFinalRequestTokens(
      modelMessages,
      tools,
    );

    expect(finalEstimate).toBeGreaterThan(messageEstimate + 2500);
  });
});
