`y-partyserver` is an addon library for `partyserver` designed to host backends for [Yjs](https://yjs.dev), a high-performance library of data structures for building collaborative software.

_This document assumes some familiarity with Yjs. If you're new to Yjs, you can learn more about it in the [official documentation](https://docs.yjs.dev)._

## Setting up a Yjs Server

Like PartyServer, `YjsDocument` is a class that extends `DurableObject` (as well as PartyServer's `Server`). The simplest Yjs backend can be set up like so:

```ts
export { YjsDocument as MyYjsServer } from "y-partyserver";

// then setup wrangler.toml and a default fetch handler
// like you would for PartyServer.
```

See [Server Configuration](#server-configuration) for configuration options.

## Connecting from the client

Use the provider to connect to this server from your client:

```ts
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";

const yDoc = new Y.Doc();

const provider = new YProvider("localhost:8787", "my-document-name", yDoc);
```

You can add additional options to the provider:

```tsx

// ...
const getAuthToken = () => { /* ... */ };
const provider = new YProvider(
  "localhost:8787",
  "my-document-name", // document name
  yDoc, // Yjs document/room instance
  {
    connect: false, // do not connect immediately, use provider.connect() when required
    party: 'my-party', // the party name to connect to
    awareness: new awarenessProtocol.Awareness(yDoc), // use your own Yjs awareness instance
    // adds to the query string of the websocket connection, useful for e.g. auth tokens
    params: async () => ({
      token: await getAuthToken()
    });
  }
);
```

## Usage with React

If you're using React, then you can use the hook version of the provider: `useYProvider`.

```ts
import useYProvider from "y-partyserver/react";

function App() {
  const provider = useYProvider({
    host: "localhost:8787", // optional, defaults to window.location.host
    room: "my-document-name",
    doc: yDoc, // optional!
    options
  });
}
```

### Persistence

By default, PartyKit maintains a copy of the Yjs document as long as at least one client is connected to the server. When all clients disconnect, the document state may be lost.

To persists the Yjs document state between sessions, you can configure onLoad and onSave methods:

```ts
// server.ts
import YjsDocument from "y-partyserver";

export class MyDocument extends YjsDocument {
  // control how often the onSave handler
  // is called with these options
  static callbackOptions = {
    // all of these are optional
    debounceWait: /* number, default = */ 2000,
    debounceMaxWait: /* number, default = */ 10000,
    timeout: /* number, default = */ 5000
  };

  // TODO: readonly mode

  onLoad() {
    // load a document from a database, or some remote resource
    // and return a Y.Doc instance here (or null if no document exists)
  }

  onSave() {
    // called every few seconds after edits
    // you can use this to write to a database
    // or some external storage
  }

  // this.document will always be the Yjs document instance
  // for this room and you can use it to interact with the document
}
```

`onLoad` is called once when a client connects to the server. It should return a Yjs document instance. Once the document has been loaded, it's kept in memory until the session ends.

`onSave` is called periodically after the document has been edited. It should be used to save the document state to a database or some other external storage.

```ts
return onConnect(conn, this.party, {
  async load() {
    return await fetchDataFromExternalService();
  },

  callback: {
    async handler(yDoc) {
      return sendDataToExternalService(yDoc);
    },
    // only save after every 2 seconds (default)
    debounceWait: 2000,
    // if updates keep coming, save at least once every 10 seconds (default)
    debounceMaxWait: 10000,
  },
});
```

## Learn more

For more information, refer to the [official Yjs documentation](https://docs.yjs.dev/ecosystem/editor-bindings). Examples provided in the Yjs documentation should work seamlessly with `y-partyserver` (ensure to replace `y-websocket` with `y-partyserver/provider`).

---

Questions? Ideas? We'd love to hear from you 🎈 Reach out to us on [Discord](https://discord.gg/KDZb7J4uxJ) or [Twitter](https://twitter.com/partykit_io)!
