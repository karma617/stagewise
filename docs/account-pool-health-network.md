# Account pool health-check network

Account-pool health checks call the Stagewise API endpoint
`/v1/usage/current` for each stored account token.

These requests use the same registration-network fallback helper as the
auto-registration flow:

1. Pick one enabled proxy from the saved proxy pool.
2. Fall back to the Electron system proxy resolver.
3. Fall back to a direct request when no proxy is available.

The batch health-check log prints the selected proxy at the start of each run.
If the log shows `未使用代理，直连请求`, the app did not resolve a proxy from the
proxy pool or Electron session, so transport errors such as
`TypeError: fetch failed` should be diagnosed as direct-network failures first.

