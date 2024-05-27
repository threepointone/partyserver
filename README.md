## partyflare

A lightweight api for durable objects, inspired by [PartyKit](https://www.partykit.io/).

```shell
npm install partyflare
```

```ts
import { Party } from "partyflare";

export class MyParty extends Party {
  onConnect(connection) {
    console.log("connected", connection.id);
  }
}

export default {
  fetch(req: Request, env) {
    return Party.match(req, env) || new Response("Not Found", { status: 404 });
  },
};
```
