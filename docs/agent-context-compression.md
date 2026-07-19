# Agent context compression

Agent chat uses shared history compression for both normal chat and goal mode.
The runtime keeps recent messages verbatim and stores older history as a
compressed briefing on a boundary message.

## Runtime behavior

- After each completed step, the runtime may start a non-blocking history
  compression when token usage since the last compression crosses the
  configured threshold.
- Before each model request, the runtime estimates the final model context
  against the active model's context window. If the prompt is close to the
  window limit, it synchronously compresses history and rebuilds the context
  before sending the request.
- If a provider still returns a context-window error such as
  `context_too_large`, the runtime compresses history once and retries the
  step instead of immediately surfacing the provider error.
- For preflight and `context_too_large` recovery, compression is allowed to be
  more aggressive than normal post-step compression: if the normal boundary
  walk thinks history is small enough but the final model prompt is still too
  large, it compresses all prior history and keeps only the latest message
  verbatim.
- If compression cannot reduce the context, the original provider error is
  shown to the user so the failure is visible and diagnosable.
- For forced recovery paths (`preflight` and `context_too_large`), if the
  LLM-based compression model times out or aborts, the runtime stores a small
  local emergency summary and retries from the recent uncompressed messages
  instead of stopping on the original context-window error.
- If a background compression is already in progress, the next request waits
  for that compression result and rebuilds context before sending, so the app
  does not keep submitting the same stale oversized prompt while compression is
  still running.
- While compression is running, agent state exposes the transient
  `runtimePhase: 'compressing-context'` marker. The browser chat UI maps it
  to `正在压缩上下文…` / `Compressing context...`, so long compression
  rounds are visible instead of looking like a stuck conversation.
- Other step phases are also visible via `runtimePhase`; see
  `docs/agent-runtime-visibility.md` for the full phase list and watchdog
  behavior.

## Large HAR/log attachments

Large diagnostic attachments are reduced before they enter model context:

- `.har` files are parsed into a network index: entry count, hosts, methods,
  status distribution, failed requests, slowest requests, content types, and
  GraphQL operation names. Request and response bodies are omitted by default.
- `.log` files are summarized when large: first/last lines, level counts,
  timestamp range, and top repeated normalized messages.
- Large `.textclip` pastes use the same summary/index behavior instead of
  injecting the full middle body.

The raw files remain mounted and readable. When exact evidence is needed, the
agent should search the path or read a narrow `start_line`/`end_line` range
instead of carrying the whole attachment through every request.

## Goal mode

Goal mode uses the same compression pipeline as normal chat. If a context
window error happens while the goal is active, the retry preserves the active
goal and re-adds the model-only goal continuation when needed.

## Tuning

- `historyCompressionThreshold` controls post-step compression.
- Post-step compression is measured from the most recent compression
  checkpoint, not from the chat's lifetime cumulative token total. That
  makes the behavior closer to a "fresh round" after each successful
  compression.
- The request preflight uses a conservative fraction of the active model's
  context window, so 1M-context models do not compress at the old 100k-token
  absolute cap.
- Chat post-step compression defaults to 50% of the context window, while
  request preflight compression uses 85% of the context window.
- Compression itself keeps a bounded recent-message budget and folds older
  compressed briefings into the next briefing, so repeated long-running goal
  tasks can continue without carrying the full raw transcript forever.
