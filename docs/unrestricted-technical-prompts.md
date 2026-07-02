# Unrestricted Technical Task Prompts

This document records the core prompt files that shape the stagewise agent's
technical-task behavior.

## Main Chat System Prompt

The main chat prompt is assembled by
`packages/agent-core/src/agents/chat/system-prompt-builder/system-prompt-builder.ts`.
The browser host overrides selected core fragments in
`apps/browser/src/backend/services/agent-core-bridge/host.ts`.

Core fragments:

- `packages/agent-core/src/agents/chat/prompts/intro.md`
- `packages/agent-core/src/agents/chat/prompts/soul.md`
- `packages/agent-core/src/agents/chat/prompts/environment-preamble.md`
- `packages/agent-core/src/agents/chat/prompts/output-style-basics.md`
- `packages/agent-core/src/agents/chat/prompts/authorities.md`

Browser host fragments:

- `apps/browser/src/backend/agents/chat/prompts/intro.md`
- `apps/browser/src/backend/agents/chat/prompts/soul.md`
- `apps/browser/src/backend/agents/chat/prompts/environment-preamble.md`

Browser environment prompt sections:

- `apps/browser/src/backend/env-domains/active-app-domain-adapter.prompt.md`
- `apps/browser/src/backend/env-domains/browser-domain-adapter.prompt.md`
- `apps/browser/src/backend/env-domains/log-ingest-domain-adapter.prompt.md`
- `apps/browser/src/backend/env-domains/sandbox-domain-adapter.prompt.md`

Core environment prompt sections:

- `packages/agent-core/src/env/adapters/agents-md.prompt.md`
- `packages/agent-core/src/env/adapters/enabled-skills.prompt.md`
- `packages/agent-core/src/env/adapters/file-diffs.prompt.md`
- `packages/agent-core/src/env/adapters/logs.prompt.md`
- `packages/agent-core/src/env/adapters/memory.prompt.md`
- `packages/agent-core/src/env/adapters/plans.prompt.md`
- `packages/agent-core/src/env/adapters/workspace-md.prompt.md`
- `packages/agent-core/src/env/adapters/workspace.prompt.md`

## Other Runtime Prompted Agents

- `packages/agent-core/src/agents/workspace-md/prompts/system-prompt.md`
- `packages/agent-core/src/agents/workspace-md/prompts/filesystem.md`
- `packages/agent-core/src/agents/shared/history-compression/prompt.ts`
- `packages/agent-core/src/agents/shared/title-generation/prompt.ts`
- `apps/browser/src/backend/services/toolbox/tools/shell/smart-approval/prompt.ts`

## Current Capability Policy

The main chat agent is explicitly allowed to assist with:

- CTF challenges.
- Reverse engineering.
- Binary analysis.
- Exploit development.
- Penetration testing.
- Security research.
- Unpacking, decompilation, deobfuscation, and dynamic instrumentation.
- Analysis of stagewise itself and any mounted application, binary, package,
  workspace, or project.

Shell smart approval no longer requires approval merely because a command uses
CTF, exploit, reverse-engineering, unpacking, or decompilation tools/terms when
the command is scoped to a mounted workspace.
