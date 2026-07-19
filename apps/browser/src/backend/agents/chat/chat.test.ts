import { describe, expect, it, vi } from 'vitest';
import { BrowserChatAgent } from './chat';

/**
 * Smoke test for the browser-specific {@link BrowserChatAgent} subclass.
 *
 * Confirms that `getAdditionalTools` asks the toolbox for every browser
 * host tool (sandbox JS, shell, library docs, linting, console logs,
 * user questions) — i.e. the host-tool surface that was previously
 * hardcoded into agent-core's `ChatAgent.getTools`.
 *
 * Like the core-side test, we bypass `BaseAgent`'s heavy constructor by
 * stubbing the few fields `getAdditionalTools` actually touches
 * (`instanceId`, `toolbox`).
 */

const HOST_TOOL_IDS = [
  'executeSandboxJs',
  'listLibraryDocs',
  'searchInLibraryDocs',
  'getLintingDiagnostics',
  'readConsoleLogs',
  'askUserQuestions',
  'createShellSession',
  'executeShellCommand',
] as const;

type StubBrowserChatAgent = {
  instanceId: string;
  toolbox: { getTool: ReturnType<typeof vi.fn> };
  hasActiveGoal: () => boolean;
  getAdditionalTools: () => Promise<Record<string, unknown>>;
};

function makeStub(
  getTool: ReturnType<typeof vi.fn>,
  hasActiveGoal = false,
): StubBrowserChatAgent {
  const instance = Object.create(
    BrowserChatAgent.prototype,
  ) as StubBrowserChatAgent;
  instance.instanceId = 'browser-chat';
  instance.toolbox = { getTool };
  instance.hasActiveGoal = () => hasActiveGoal;
  return instance;
}

describe('BrowserChatAgent', () => {
  it('defaults new browser chat agents to the Default alias', () => {
    expect(BrowserChatAgent.config.defaultModelId).toBe('default');
  });

  it('getAdditionalTools requests every browser host tool from the toolbox', async () => {
    const getTool = vi.fn().mockResolvedValue({ kind: 'host-tool' });
    const instance = makeStub(getTool);

    const extra = await instance.getAdditionalTools();

    expect(Object.keys(extra).sort()).toEqual([...HOST_TOOL_IDS].sort());

    const requestedNames = getTool.mock.calls.map(([name]) => name).sort();
    expect(requestedNames).toEqual([...HOST_TOOL_IDS].sort());

    for (const id of HOST_TOOL_IDS) {
      expect(getTool).toHaveBeenCalledWith(id, 'browser-chat');
    }
  });

  it('propagates null results when the toolbox cannot supply a host tool', async () => {
    const getTool = vi
      .fn()
      .mockImplementation(async (name: string) =>
        name === 'executeSandboxJs' ? null : { kind: 'host-tool' },
      );
    const instance = makeStub(getTool);

    const extra = await instance.getAdditionalTools();

    expect(extra.executeSandboxJs).toBeNull();
    expect(extra.executeShellCommand).toEqual({ kind: 'host-tool' });
  });

  it('does not expose askUserQuestions while goal mode is active', async () => {
    const getTool = vi.fn().mockResolvedValue({ kind: 'host-tool' });
    const instance = makeStub(getTool, true);

    const extra = await instance.getAdditionalTools();

    expect(extra.askUserQuestions).toBeNull();
    expect(getTool).not.toHaveBeenCalledWith(
      'askUserQuestions',
      'browser-chat',
    );
    expect(getTool).toHaveBeenCalledWith(
      'executeShellCommand',
      'browser-chat',
    );
  });
});
