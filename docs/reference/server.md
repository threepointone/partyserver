## Server

You define a PartyServer by `extend`ing the `Server` class.

```ts
import { Server } from "partyserver";

export class MyServer extends Server</* optional */ Env> {
  // ... define lifecycle hooks and other methods
}
```

Here, `Env` corresponds to the [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) defined for your Worker, usually configured in `wrangler.toml`. You can automatically generate this type definition by running `wrangler types` in your project directory.

### Lifecycle Hooks

- `onStart()` - Called when the server starts for the first time or after waking up from hibernation
- `onConnect(connection, connContext)` - Called when a new connection is established
- `onMessage(connection, message)` - Called when a message is received from a connection
- `onClose(connection, code, reason, wasClean)` - Called when a connection is closed
- `onError(error)` - Called when an error occurs on a connection
- `onRequest(request): Response` - Called when a request is received from the fetch handler
- `getConnectionTags(connection, connContext): string[]` - Assign tags to a connection

(All of these methods can be optionally `async`):

### Additional Methods

- `broadcast(message, exclude = [])` - Send a message to all connections, optionally excluding some
- `getConnections(tags = [])` - Get all connections, optionally filtered by tags
- `getConnection(id)` - Get a connection by its ID

## Properties

- `.name` - (readonly) this is automatically set to the server's name, determined by `getServerByName()` or `routePartykitRequest()`.
- `.ctx` - the context object for the Durable Object, containing references to [`storage`](https://developers.cloudflare.com/durable-objects/api/transactional-storage-api/)
- `.env` - the environment object for the Durable Object, usually defined by bindings and other configuration in your `wrangler.toml` configuration file.

### Durable Object methods

- `fetch(request)` - PartyServer overrides the `fetch` method to add the lifecycle methods to the server instance. In most cases you don't have to implement this mehod yourself. If you do (for example, to add request handling before any lifecycle methods are called), make sure to call `super.fetch(request)` as appropriate to ensure the lifecycle methods are called.

- `alarm()` - Implement this method to handle alarms. This is the only way to run code after the server has been evicted. Read more about alarms [here](https://developers.cloudflare.com/durable-objects/api/alarms/).

- Do not implement any of these methods on your server class: `webSocketMessage` /`webSocketClose` / `webSocketError`. We override them to call the lifecycle methods in hibernation mode.

### Hibernation

You can enable [hibernation](https://developers.cloudflare.com/durable-objects/reference/websockets/#websocket-hibernation) by setting a static `options` property on your Server class. This allows the server to hibernate when not in use and wake up when a new connection is established. All lifecycle hooks will be called as expected when the server wakes up.

```ts
export class MyServer extends Server {
  static options = {
    hibernate: true
  };
  // ...
}
```

In the future, `options` may support additional properties for configuring the server.
