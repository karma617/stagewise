# Agent usage summary

Stagewise can render a compact usage line under a completed assistant message.

## What it shows

- total tokens
- input tokens
- output tokens
- cached input tokens
- cache hit rate
- context tokens vs context window
- preflight compression threshold used before the next model request
- model call count
- elapsed time

## Source of truth

The values come from assistant-message metadata written by the agent runtime at
the end of a step. The UI reads the stored summary and renders it only after
the assistant turn has completed. The current streaming assistant message does
not show the summary until the turn settles.

## Notes

The summary is cumulative across the conversation, not just the latest call in
isolation.
