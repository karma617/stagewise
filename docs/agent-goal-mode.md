# Agent goal mode

Goal mode gives an LLM chat turn a Codex-style task objective that can be
tracked separately from normal chat text.

## Behavior

- Goal mode is off by default. The chat footer target button enables it for
  the current chat input.
- When a user sends the first message while goal mode is enabled, the backend
  creates an active goal on that agent. The objective is the text content of
  that first user message.
- Once a goal exists, later user messages never replace it. Those messages are
  treated as supplemental instructions for the original goal.
- Normal chat messages do not create a goal unless goal mode is enabled and no
  goal already exists.
- Clean idle does not complete the goal by itself. The model must explicitly
  call `updateGoal` after the original objective is actually complete.
- If a step ends cleanly while the goal is still `active`, the runtime
  automatically injects a model-only continuation and starts another step.
  This does not append a visible user message to chat history.
- If an active goal step stalls without model output or lifecycle events for
  the watchdog threshold, the runtime clears the stuck step, injects the same
  model-only continuation, and starts another step instead of marking the goal
  blocked.
- While a goal is `active`, the run is unattended. The model must not wait
  for user input or ask the user to choose; it should pick the most reasonable
  next step and try viable alternatives until the objective is reached or an
  external state change is genuinely required.
- While a goal is `active`, shell commands run without manual approval prompts.
  This is a runtime override only and does not change the user's saved tool
  approval setting; pausing or ending the goal restores the configured mode.
- When the agent records a runtime error, the active goal is marked `blocked`
  with the error message as the block reason.
- When the user stops the running agent, the active goal is marked `blocked`
  with a user-stop reason.
- The UI can pause an active goal. Pausing stops the current run but keeps the
  goal as `paused` instead of marking it blocked.
- Resuming a paused goal restores it to `active` and sends a supplemental
  continue instruction without creating a new goal.
- The UI can edit the current goal objective in place. Empty edits are ignored.
- The UI can delete the current goal when the user wants to leave goal mode
  tracking for that chat.

## LLM Tools

Every chat step exposes two model-visible goal tools:

- `getGoal`: returns the current goal, token usage, and status.
- `updateGoal`: marks the current active goal as `complete` or `blocked`.
  While the goal is still active, the model should not call this tool; if it
  does send an active/running-style status, the call is treated as a no-op
  instead of surfacing a schema validation error.

Goal creation is handled by the frontend goal-mode entry path and the
backend send-message options. The model does not receive a `createGoal` tool.

An `active` goal is not a terminal state. The runtime keeps running new steps
until the model calls `updateGoal` with `complete` or `blocked`, the user
pauses/deletes/stops the goal, or a runtime error blocks the agent.

For normal chat turns, the same step-activity watchdog turns a silent stall
into a visible runtime error. For active goals, the watchdog is a recovery
path: it keeps the goal active and continues unattended.

Goal mode also uses the shared context compression pipeline described in
`docs/agent-context-compression.md`. Before each model request, the runtime can
compress and rebuild context; if the provider still returns `context_too_large`,
the active goal is preserved and retried once after compression. Cumulative
token usage is not treated as the current context-window size and does not
stop unattended continuation by itself.

These tools only mutate the in-memory state for the current agent. They do not
touch files, network settings, accounts, or proxy state.

When goal mode is active, `askUserQuestions` is not exposed to browser chat
agents. If a host-side caller reaches that tool anyway, it returns a no-op
unattended-mode notice instead of creating a pending question dialog.

## UI

When a goal exists, the chat footer shows a compact floating goal status card.
It sits above the input box and the footer status card, so queued user
instructions can grow upward without being covered. The card shows the
objective, current status, and block reason when blocked. The card's right
side exposes edit, delete, and run-state controls. The run-state control is
pause for active goals and continue for paused or blocked goals.

## Persistence and Message Edits

The current goal is mirrored into the latest user message metadata as
`goalSnapshot` whenever goal state changes or agent state is persisted. This
keeps the last goal with the persisted message history without requiring a
separate agent database column.

Because the latest user message is often not the tail message after an
assistant response, persistence marks that user-message row dirty whenever the
snapshot is refreshed. This keeps terminal states such as `complete` from
falling behind the in-memory state and being restored as older `active`
snapshots after app restart.

A `null` `goalSnapshot` is a tombstone written when the user deletes the goal.
On resume, the agent scans user messages from newest to oldest; the first
snapshot restores the goal, and the first tombstone prevents older snapshots
from coming back.

For older rows written before dirty-message persistence was fixed, resume also
checks newer assistant `updateGoal` tool output. If that output belongs to the
same goal, its terminal status wins over the stale user-message snapshot.

When a user edits a historical message and the footer goal-mode toggle is on,
the replace-message RPC restores the last durable goal before sending the
edited message. Paused or blocked snapshots are reactivated for this explicit
goal-mode edit path so the task continues under the previous objective instead
of treating the edited message as a new goal.

When an app restart resumes an agent whose last durable goal is still
`active`, the runtime triggers the same model-only goal continuation used after
clean idle, so the task keeps running unattended after reopen.

Legacy snapshots that were blocked with `Goal token budget reached (...)` are
reactivated on restore and have that stale budget cleared. That message came
from cumulative usage crossing a stored budget, not from the current model
request exceeding the context window.
