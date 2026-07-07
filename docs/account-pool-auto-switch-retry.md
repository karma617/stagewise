# Account Pool Auto-Switch Retry

## Scope

When a chat request hits the current account's quota limit, the runtime error
card tries to switch to an available account from the account pool and then
retries the failed message.

## Available Account Cache

The backend refreshes all account-pool usage once on startup. After that first
refresh, accounts with usable quota are placed into an in-memory
available-account pool, while accounts without quota are placed into a cooldown
pool sorted by expected reset time.

Full usage refreshes run as a bounded concurrent backend task. The refresh
worker fans out up to 16 account requests at a time and yields back to the
event loop after each account, so large account pools do not monopolize the
main process.

The settings page does not wait synchronously for a full usage refresh to
finish. It starts the backend refresh, keeps the UI interactive, and then pulls
fresh account-pool snapshots shortly after the refresh begins.

The recurring 3-minute background refresh only checks the cooldown pool. It
does not keep refreshing accounts that already have usable quota.

Automatic switching reads from this available pool directly. It does not do a
full account-pool usage refresh on the switching path, so switch latency no
longer grows linearly with the number of accounts in the pool.

When automatic switching is triggered because the current account reaches a
quota limit, that current account is removed from the available pool and added
to the cooldown pool with the reset time reported by the quota error.

When LLM requests return `403` after more than 10 successful Clash node
switches, Stagewise treats the current account as suspicious rather than
quota-cooled. The account is marked `observing`, remains visible in the
account-pool list, and is excluded from the available-account pool and future
automatic switching.

The available pool is consumed in FIFO rotation. When a switch attempt fails,
that candidate is skipped for the current switch attempt and removed from the
available pool until a later refresh rebuilds the cache.

## Default

Automatic account switching now retries failed switch calls up to 30 times by
default. Each retry keeps the existing 800 ms delay.

## User Setting

The retry count is configurable in Settings -> Account pool. The field is named
"Auto-switch retry attempts" / "自动切换失败重试次数".

The value is stored in user preferences at
`agent.accountPoolAutoSwitchMaxAttempts` and is clamped to at least 1.
