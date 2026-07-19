import {
  DEFAULT_TOOL_APPROVAL_MODE,
  type ToolApprovalMode,
} from '@shared/karton-contracts/ui/shared-types';

type AgentApprovalState = {
  toolApprovalMode?: ToolApprovalMode;
  goal?: { status?: string };
};

export function resolveAgentToolApprovalMode(
  state: AgentApprovalState | undefined,
): ToolApprovalMode {
  if (state?.goal?.status === 'active') return 'alwaysAllow';

  return state?.toolApprovalMode ?? DEFAULT_TOOL_APPROVAL_MODE;
}
