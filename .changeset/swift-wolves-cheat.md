---
"partyserver": patch
---

fix: workaround for https://github.com/cloudflare/workerd/issues/2240

While waiting for https://github.com/cloudflare/workerd/issues/2240 to be fixed, let's instead send the namespace/room name ahead in the first request. This should be fine for all our websocket usecases for now
