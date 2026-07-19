import { describe, expect, it } from 'vitest';
import { resolveAgentToolApprovalMode } from './tool-approval-mode';

describe('resolveAgentToolApprovalMode', () => {
  it('keeps the configured approval mode when no goal is active', () => {
    expect(
      resolveAgentToolApprovalMode({ toolApprovalMode: 'alwaysAsk' }),
    ).toBe('alwaysAsk');
  });

  it('forces unattended shell execution while a goal is active', () => {
    expect(
      resolveAgentToolApprovalMode({
        toolApprovalMode: 'alwaysAsk',
        goal: {
          status: 'active',
        },
      }),
    ).toBe('alwaysAllow');
  });

  it('restores configured approval mode when a goal is paused', () => {
    expect(
      resolveAgentToolApprovalMode({
        toolApprovalMode: 'smart',
        goal: {
          status: 'paused',
        },
      }),
    ).toBe('smart');
  });
});
