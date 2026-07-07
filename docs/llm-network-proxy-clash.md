# LLM request proxy and Clash retry

The browser app can route LLM chat requests through a local HTTP proxy and use
the Clash external controller to rotate nodes when the provider returns
`403`/`Forbidden`.

LLM requests also mask client identity headers before they leave the app. The
network layer removes the Stagewise Electron client header and replaces the
SDK/runtime user agent with a stable browser-like user agent.

## Settings

Open `Settings -> General -> Chat request network`.

- `Local HTTP proxy`: proxy used by LLM chat requests. The default is
  `http://127.0.0.1:7897`.
- `Clash controller URL`: Clash external controller. The default is
  `http://127.0.0.1:9097`; an empty saved value also falls back to this
  default.
- `Clash secret`: external controller secret. It is set by default and shown as
  a password field. An empty saved value falls back to the default secret.
- `Clash proxy group`: selector group used for node rotation. The default is
  `GLOBAL`. If the field is empty, Stagewise uses `GLOBAL`, then the first
  switchable `Selector` group returned by Clash if `GLOBAL` is unavailable.

Open `Settings -> Proxy pool` to control whether chat requests use the proxy
pool:

- `Prefer proxy pool for LLM chat`: off by default. When enabled, LLM chat
  requests pick one enabled proxy from the proxy pool before using the local
  HTTP proxy setting.
- If the switch is enabled but the proxy pool has no enabled proxies, Stagewise
  falls back to the local HTTP proxy setting, which defaults to
  `http://127.0.0.1:7897`.

## Retry Behavior

When an LLM response is `403` or contains `Forbidden`, Stagewise asks Clash for
the selected group's nodes, switches to each remaining node, and retries the
same request through the selected LLM proxy. With proxy-pool mode enabled, the
selected proxy is held for that request and its Clash retries.

Only one Clash node switch task can run at a time. If multiple chat requests
hit `403` concurrently, the first request owns the Clash switch loop and the
other requests wait for that shared result instead of starting duplicate
`/proxies` reads or node switch calls.

While this happens, the chat history shows a live network status instead of an
empty waiting area. The status covers reading Clash nodes, switching the current
candidate node, and retrying the chat request after a node switch.

Backend logs use the `[llm-network]` prefix during node rotation. They include
the Clash group, candidate node name, Clash ping/delay, the Clash switch API
status, and the retried LLM request's HTTP status plus `Forbidden` result.

If every candidate node still fails with `Forbidden`, the request fails with:

```text
当前订阅无可用节点，请更换订阅重试
```

If more than 10 successfully switched Clash nodes all retry the LLM request
and still return `403`/`Forbidden`, Stagewise stops switching more nodes and
treats the current account as suspicious instead of treating the failure as
node-only. The chat error UI then marks the current account as `observing`,
excludes it from future automatic account-pool switches, switches to another
available account, and retries the failed request.

This retry path is scoped to LLM provider requests. It does not affect browser
page loading, account registration proxy pools, file operations, or tool
execution.
