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

(All these methods can be optionally `async`)

- `onStart()`: Called when the server starts for the first time or after waking up from hibernation. You can use this to load data from storage and perform other initialization, such as retrieving data or configuration from other services or databases.

- `onConnect(connection, context)` - Called when a new websocket connection is established. You can use this to set up any connection-specific state or perform other initialization. Receives a reference to the connecting `Connection`, and a `ConnectionContext` that provides information about the initial connection request.

- `onMessage(connection, message)` - Called when a message is received on a connection.

- `onClose(connection, code, reason, wasClean)` - Called when a connection is closed by a client. By the time `onClose` is called, the connection is already closed and can no longer receive messages.

- `onError(error)` - Called when an error occurs on a connection.

- `onRequest(request): Response` - Called when a request is made to the server. This is useful for handling HTTP requests in addition to WebSocket connections.

- `getConnectionTags(connection, context): string[]` - You can set additional metadata on connections by returning them from `getConnectionTags()`, and then filter connections based on the tag with `this.getConnections`.

### Additional Methods

- `broadcast(message, exclude = [])` - Send a message to all connections, optionally excluding connection ids listed in the second array parameter.

- `getConnections(tags = [])` - Get all currently connected WebSocket connections, optionally filtered by tags set by `getConnectionTags()`. Returns an iterable list of `Connection`.

- `getConnection(id)` - Get a connection by its ID.

## Properties

- `.name` - (readonly) this is automatically set to the server's "name", determined by `getServerByName()` or `routePartykitRequest()`.

- `.ctx` - the context object for the Durable Object, containing references to [`storage`](https://developers.cloudflare.com/durable-objects/api/transactional-storage-api/)

- `.env` - the environment object for the Durable Object, defined by bindings and other configuration in your `wrangler.toml` configuration file.

### Durable Object methods

- `fetch(request)` - PartyServer overrides the `fetch` method to add the lifecycle methods to the server instance. In most cases you don't have to implement this mehod yourself. If you do (for example, to add request handling before any lifecycle methods are called), make sure to call `super.fetch(request)` as appropriate to ensure the lifecycle methods are called.

- `alarm()` - Implement this method to handle alarms. This is the only way to run code after the server has been evicted. Read more about alarms [here](https://developers.cloudflare.com/durable-objects/api/alarms/).

- Do not implement any of these methods on your server class: `webSocketMessage` /`webSocketClose` / `webSocketError`. We override them to call the lifecycle methods in hibernation mode.

### Connection Properties

A connection is a standard WebSocket with the following additional properties:

- `id` - A unique ID for the connection
- `tags` - An array of tags assigned to the connection (TODO)
- `server` - The server name the connection is in
- `state` - Arbitrary state data (up to 2KB) that can be set on the connection using `connection.setState()`

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

### Utility Methods

- `getServerByName(namespace, name, {locationHint, jurisdiction}): Promise<DurableObjectStub>` - Create a new Server with a specific name. Optionally pass a `locationHint` to specify the [location](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint) or `jurisdiction` to specify the [jurisdiction](https://developers.cloudflare.com/durable-objects/reference/data-location/#restrict-durable-objects-to-a-jurisdiction) of the server.

- `routePartykitRequest(request, env, {locationHint, jurisdiction, prefix = 'parties'}): Promise<Response | null>` - Match a request to a server. Takes a URL of the form `/${prefix}/:server/:name` and matches it with any namespace named `:server` (case insensitive) and a server named `:name`. Optionally pass a `locationHint` to specify the [location](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint) or `jurisdiction` to specify the [jurisdiction](https://developers.cloudflare.com/durable-objects/reference/data-location/#restrict-durable-objects-to-a-jurisdiction) of the server.
