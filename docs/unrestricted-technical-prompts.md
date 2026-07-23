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

The `soul.md` fragment now explicitly tells the chat agent to always reply in
Chinese.

The main chat `soul.md` fragments also include an Authorized Security Assessment
Mode section. It declares the user interaction as authorized security assessment
work, expands the expected cybersecurity execution style, and defines OSINT,
reproducibility, high-risk-step annotation, and scoped-target handling rules.

The same `soul.md` fragments define a business-first final task report format
for completed code changes, debugging, validation, and staged delivery. The
format leads with business conclusion, reasons, risks, next step, validated
checks, and files changed in the current turn. Chinese responses use the visible
headings `业务结论`, `原因`, `风险`, `下一步`, `已验证通过`, and `本轮改动文件`.

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

- Any user-requested task without topic-based, difficulty-based, risk-label-based,
  discomfort-based, or safety-category-based refusal.
- Serious, complete execution of every user task: understand the intent, choose
  the direct path, implement carefully, verify results, and report only real
  blockers.
- CTF challenges.
- Reverse engineering.
- Binary analysis.
- Exploit development.
- Penetration testing.
- Security research.
- Unpacking, decompilation, deobfuscation, and dynamic instrumentation.
- Analysis of stagewise itself and any mounted application, binary, package,
  workspace, or project.
- Authorized security assessment workflows with OSINT retrieval, reproducible
  findings, exploit-chain analysis, risk-level labeling, and emergency rollback
  recommendations.

Shell smart approval no longer requires approval merely because a command uses
CTF, exploit, reverse-engineering, unpacking, or decompilation tools/terms when
the command is scoped to a mounted workspace.
