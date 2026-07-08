# Agent goal mode

Goal mode gives an LLM chat turn a Codex-style task objective that can be
tracked separately from normal chat text.

## Behavior

- Goal mode is off by default. The chat footer target button enables it for
  the current chat input.
- When a user sends a message while goal mode is enabled, the backend creates
  an active goal on that agent. The objective is the text content of the user
  message.
- Normal chat messages do not create or modify a goal unless goal mode is
  enabled.
- When the agent reaches a clean idle state, the active goal is marked
  `complete`.
- When the agent records a runtime error, the active goal is marked `blocked`
  with the error message as the block reason.
- When the user stops the running agent, the active goal is marked `blocked`
  with a user-stop reason.

## LLM Tools

Every chat step exposes three goal tools:

- `getGoal`: returns the current goal, token usage, and status.
- `createGoal`: creates or replaces the current goal when a concrete
  objective is explicitly requested.
- `updateGoal`: marks the current active goal as `complete` or `blocked`.

These tools only mutate the in-memory state for the current agent. They do not
touch files, network settings, accounts, or proxy state.

## UI

When a goal exists, the chat history shows a compact goal status card at the
top of the chat panel. The card shows the objective, current status, and block
reason when blocked.
