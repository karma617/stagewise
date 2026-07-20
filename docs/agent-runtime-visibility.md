# Agent runtime visibility

Agent chat exposes transient runtime phases while a step is running so the UI can show what the agent is waiting on instead of a generic `Working...` label.

## Runtime phases

The `AgentState.runtimePhase` field is ephemeral and is cleared on resume, step start, step completion, step error, stop, and watchdog timeout.

Current phases:

- `preparing-context`: the agent is resolving the model, generating context, rebuilding context after compression, or doing post-stream context bookkeeping.
- `preparing-tools`: the agent is loading and wrapping tools before the model request.
- `waiting-for-model`: the model request is open and the runtime is waiting for response chunks or the request to finish.
- `compressing-context`: history compression is running before the next model request can proceed.
- `waiting-for-model` is only shown while the request is still waiting to start
  or before the first visible assistant output; once assistant text is already
  flowing, the UI keeps the response visible and hides this waiting label.

## Watchdog behavior

The step activity watchdog starts when the runtime enters `waiting-for-model`, not during context generation or compression. This covers stalls while the model request is open and while the stream is consuming output, without treating long compression work as a stream stall.

Tool execution counts as runtime activity. While a tool is running, the runtime
emits a lightweight internal heartbeat so long-running shell commands or other
tools are not mistaken for a stalled LLM stream. Tool-specific timeouts and user
stop/cancel handling still own actual tool cancellation.

For normal chat, a watchdog timeout records a visible runtime error. For active goal mode, a watchdog timeout clears the stuck step, keeps the goal active, injects a hidden goal continuation, and starts another step.

## UI behavior

The browser chat loading indicator maps `runtimePhase` to localized labels:

- `preparing-context`: `正在准备上下文…`
- `preparing-tools`: `正在准备工具…`
- `waiting-for-model`: `正在等待模型响应…`
- `compressing-context`: `正在压缩上下文…`

If no phase is available, the UI falls back to the existing `Working...` state.

## Runtime diagnostics

The browser backend writes persistent logs under the app data logs directory:

- Development build: `%APPDATA%\stagewise-dev\stagewise\user-data\logs`
- Production build: `%APPDATA%\stagewise\stagewise\user-data\logs`

Important files:

- `stagewise-backend.log`: rotating backend log with debug, info, warn, and error entries.
- `stagewise-backend-error.log`: rotating warn/error-only log.
- `agent-runtime-YYYY-MM-DD.jsonl`: structured agent step events. Each line is one JSON object with `traceId`, `agentId`, `stepGeneration`, `runtimePhase`, and event-specific fields.

The runtime trace records request lifecycle milestones without storing full prompts or credentials:

- `step-start`, `model-resolved`, `context-ready`, and `tools-ready`
- `stream-request-start`, `stream-finish`, `stream-error`, and `stream-abort`
- `context-preflight-compression`, `compression-start`, `compression-boundary-selected`, `compression-finish`, and `compression-error`
- `compression-emergency-fallback` when forced context recovery stores a local
  compact summary because the LLM compression model timed out or aborted

The LLM network wrapper logs request summaries to `stagewise-backend.log` with a per-request id, method, URL origin/path, proxy mode, status code, and elapsed time. It intentionally does not persist authorization headers, cookies, API keys, or full request bodies.

OpenAI Responses requests do not replay stored reasoning item signatures, because the app sends requests with non-persistent response storage. If a provider error mentions a missing `rs_...` item, check that the active route is using the Responses path without `reasoningSignatureSource`.

Shell command polling is intentionally short for empty-command follow-ups: a poll without explicit `wait_until` now returns after about two seconds when no new output arrives, and raw stdin follow-ups use about three seconds. Longer waits still require explicit `wait_until` on the tool call.

When a chat appears stuck, first filter `agent-runtime-YYYY-MM-DD.jsonl` by the latest `agentId` or `traceId`. If the last event is `stream-request-start`, compare the timestamp with the matching `[llm-network] request start` / `request response` / `request error` lines in `stagewise-backend.log`. If the last event is `compression-start`, inspect the following compression events to determine whether context compression is still running, completed, or failed.
