# Agent context compression

Agent chat uses shared history compression for both normal chat and goal mode.
The runtime keeps recent messages verbatim and stores older history as a
compressed briefing on a boundary message.

## Runtime behavior

- After each completed step, the runtime may start a non-blocking history
  compression when token usage since the last compression crosses the
  configured threshold.
- Before each model request, the runtime first checks token usage since the
  latest compression checkpoint. If that usage already crosses the preflight
  limit, it synchronously compresses history even before prompt estimation. It
  then estimates the model messages against the active model's context window.
  After tools are constructed, it performs one final synchronous preflight that
  also counts serialized tool JSON schemas and request-wrapper overhead before
  entering `waiting-for-model`; if that final request estimate is still close
  to the window limit, it compresses again and rebuilds context before sending.
- The preflight uses the exact `contextWindowSize` resolved for the current
  agent step. This keeps custom-provider context limits, such as a 480k
  endpoint override for a built-in model, aligned between the visible usage
  badge and the backend request gate.
- If history compression still cannot bring the final request under the
  preflight limit, the runtime rebuilds a lean context that skips file
  context, path-reference expansion, env capture, and skills before sending.
  This prevents large current-turn attachments such as `.textclip` files from
  being re-injected after history has already been compacted.
- Legacy compressed histories that do not have a saved compression checkpoint
  are treated as having no baseline, so an already-oversized restored goal
  session still triggers preflight compression instead of skipping it.
- For built-in models routed through a custom provider, an optional custom
  provider "Model Max Context" setting overrides the built-in model window for
  context accounting and automatic compression triggers.
- If a provider still returns a context-window error such as
  `context_too_large` / `maximum prompt length`, including errors where the
  top-level message is only a generic `Upstream error: 400`, the runtime reads
  the response body, compresses history once, and retries the step instead of
  immediately surfacing the provider error.
- For preflight and `context_too_large` / `maximum prompt length` recovery,
  compression is allowed to be more aggressive than normal post-step
  compression: if the normal boundary
  walk thinks history is small enough but the final model prompt is still too
  large, it compresses all prior history and keeps only the latest message
  verbatim.
- If compression cannot reduce the context, the original provider error is
  shown to the user so the failure is visible and diagnosable.
- For forced recovery paths (`preflight` and `context_too_large` /
  `maximum prompt length`), if the LLM-based compression model times out or
  aborts, the runtime stores a small
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
  request preflight compression uses 75% of the context window, leaving extra
  room for provider-side tokenization differences and tool-schema overhead.
- Compression itself keeps a bounded recent-message budget and folds older
  compressed briefings into the next briefing, so repeated long-running goal
  tasks can continue without carrying the full raw transcript forever.
