import { describe, expect, it, vi } from 'vitest';
import {
  executeShellCommand,
  type SmartApprovalDeps,
} from './execute-shell-command';
import type { ShellService } from '../engine';
import { executeShellCommandToolInputSchema } from '../schemas';

const createSmartApprovalDeps = (): SmartApprovalDeps => ({
  classify: vi.fn(async () => ({
    needsApproval: false,
    explanation: 'safe',
  })),
  recordPendingApproval: vi.fn(),
});

const createShellService = (): ShellService =>
  ({
    getRecentOutputForClassifier: vi.fn(() => ''),
    getSessionCurrentCwd: vi.fn(() => '/tmp'),
    executeInSession: vi.fn(),
    clearPendingOutputs: vi.fn(),
  }) as unknown as ShellService;

describe('executeShellCommand approval', () => {
  it('always allows kill calls even when approval mode is alwaysAsk', async () => {
    const shellService = createShellService();
    const smartApproval = createSmartApprovalDeps();
    const tool = executeShellCommand(
      shellService,
      'agent-1',
      () => 'alwaysAsk',
      () => new Map([['wtest', '/tmp']]),
      smartApproval,
    );

    expect(typeof tool.needsApproval).toBe('function');
    if (typeof tool.needsApproval !== 'function') {
      throw new Error('Expected executeShellCommand to define needsApproval');
    }

    const needsApproval = await tool.needsApproval(
      {
        explanation: 'Close terminal',
        session_id: 'session-1',
        kill: true,
      },
      { toolCallId: 'tool-1', messages: [] },
    );

    expect(needsApproval).toBe(false);
    expect(smartApproval.classify).not.toHaveBeenCalled();
    expect(smartApproval.recordPendingApproval).not.toHaveBeenCalled();
  });
});

describe('executeShellCommand schema', () => {
  it('accepts command and stdin together so runtime can guide repair', () => {
    const result = executeShellCommandToolInputSchema.safeParse({
      explanation: 'Answer prompt',
      session_id: 'session-1',
      command: 'npm create vite',
      stdin: 'y\\r',
    });

    expect(result.success).toBe(true);
  });
});

describe('executeShellCommand runtime', () => {
  it('treats empty stdin as absent when command is present', async () => {
    const shellService = createShellService();
    vi.mocked(shellService.executeInSession).mockResolvedValue({
      sessionId: 'session-1',
      output: 'ok',
      exitCode: 0,
      sessionExited: false,
      timedOut: false,
      resolvedBy: 'exit',
    });
    const tool = executeShellCommand(
      shellService,
      'agent-1',
      () => 'alwaysAllow',
      () => new Map([['wtest', '/tmp']]),
    );

    expect(typeof tool.execute).toBe('function');
    if (typeof tool.execute !== 'function') {
      throw new Error('Expected executeShellCommand to define execute');
    }

    const output = await tool.execute(
      {
        explanation: 'Run tests',
        session_id: 'session-1',
        command: 'python -m pytest tests/test_paypal_link_rules.py -q',
        stdin: '',
      },
      {
        toolCallId: 'tool-1',
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );

    expect(shellService.executeInSession).toHaveBeenCalledWith(
      'agent-1',
      'tool-1',
      expect.objectContaining({
        command: 'python -m pytest tests/test_paypal_link_rules.py -q',
        sessionId: 'session-1',
      }),
    );
    expect(
      vi.mocked(shellService.executeInSession).mock.calls[0]?.[2],
    ).not.toHaveProperty('rawInput');
    expect(output).toMatchObject({
      session_id: 'session-1',
      output: 'ok',
      resolved_by: 'exit',
    });
  });

  it('does not send shell input when command and stdin are both non-empty', async () => {
    const shellService = createShellService();
    const tool = executeShellCommand(
      shellService,
      'agent-1',
      () => 'alwaysAllow',
      () => new Map([['wtest', '/tmp']]),
    );

    expect(typeof tool.execute).toBe('function');
    if (typeof tool.execute !== 'function') {
      throw new Error('Expected executeShellCommand to define execute');
    }

    const output = await tool.execute(
      {
        explanation: 'Answer prompt',
        session_id: 'session-1',
        command: 'npm create vite',
        stdin: 'y\\r',
      },
      {
        toolCallId: 'tool-1',
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );

    expect(shellService.executeInSession).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      session_id: 'session-1',
      output: expect.stringContaining('Received both command and stdin'),
      resolved_by: 'abort',
    });
  });
});
