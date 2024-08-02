---
"y-partyserver": patch
"partyserver": patch
---

some fixes and tweaks

- getServerByName was throwing on all requests
- `Env` is now an optional arg when defining `Server`
- `y-partyserver/provider` can now take an optional `prefix` arg to use a custom url to connect
- `routePartyKitRequest`/`getServerByName` now accepts `jurisdiction`

bonus:

- added a bunch of fixtures
- added stubs for docs
