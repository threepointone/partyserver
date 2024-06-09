# PartyServer

Buuild real-time applications powered by [Durable Objects](https://developers.cloudflare.com/durable-objects/), inspired by [PartyKit](https://www.partykit.io/).

> [!CAUTION]
> This project is in its experimental early stages and is not recommended for production use.

## Installation

To install PartyServer, run the following command:

```shell
npm install partyserver
```

## Why Use PartyServer?

PartyServer enhances Durable Objects with the following features:

- Simple "room"-based routing
- Lifecycle hooks for connections and requests
- A unified API for managing hibernated and non-hibernated Durable Objects
- Easy broadcasting to all or selected connections in a server

## How is it different from PartyKit?

- Decouples the idea of a URL from the server name. This is useful when you want to associate a server with some other identifier like a session ID, etc. You can still use `Server.partyFetch()` to get PartyKit-style route matching.
- Doesn't include bindings for other services like AI, static assets, etc. Instead, use wrangler's built-in support for those services.
- Doesn't have PartyKit's auto-inferred declaration for Durable Object bindings and migrations, so you have to manually specify these in `wrangler.toml`. We may add this in the future.

## Usage

Here's an example of how to use PartyServer:

Write your code:

```ts
// index.ts

import { Server } from "partyserver";

// Define your Servers
export class MyServer extends Server {
  onConnect(connection) {
    console.log("Connected", connection.id, "to server", this.name);
  }

  onMessage(connection, message) {
    console.log("Message from", connection.id, ":", message);
    // Send the message to every other connection
    this.broadcast(message, [connection.id]);
  }
}

export default {
  // Set up your fetch handler to use configured Servers
  fetch(request, env) {
    return (
      Server.partyFetch(request, env) ||
      new Response("Not Found", { status: 404 })
    );
  }
};
```

And configure your `wrangler.toml`:

```toml
name = "my-partyserver-app"
main = "index.ts"

[[durable_objects.bindings]]
name = "MyServer"
class_name = "MyServer"

[[migrations]]
tag = "v1" # Should be unique for each entry
new_classes = ["MyServer"]
```

See the [`/examples`](https://github.com/threepointone/partyserver/tree/main/examples) folder for more specific examples.

## Comparison to Erlang/Elixir

"Wait", I hear you say, "this looks a lot like Erlang/Elixir's actor model!" And you'd be right! Durable Objects are inspired by the actor model/[GenServer](https://hexdocs.pm/elixir/1.12/GenServer.html) and aims to provide a similar experience for developers building applications on Cloudflare Workers. It's implemented fully in the infrastructure layer, so you don't have to maintain your own infrastructure.

Instead of spawning "actors", you create servers that handle connections and messages. This is because Durable Objects are designed to be long-lived and stateful, so it makes sense to model them as servers that can handle multiple connections.

It differs in a specific way: There's no "terminate" handler, because a Durable Object can "shut down" / get evicted at any time, and we can't reliably call a "terminate" handler. Instead, you can set an alarm to run some cleanup code at some point in the future.

## Customizing `Server`

`Server` is a class that extends `DurableObject`. You can override the following methods on `Server` to add custom behavior:

### Lifecycle Hooks

These methods can be optionally `async`:

- `onStart()` - Called when the server starts for the first time or after waking up from hibernation
- `onConnect(connection, connContext)` - Called when a new connection is established
- `onMessage(connection, message)` - Called when a message is received from a connection
- `onClose(connection, code, reason, wasClean)` - Called when a connection is closed
- `onError(error)` - Called when an error occurs on a connection
- `onRequest(request): Response` - Called when a request is received from the fetch handler
- `getConnectionTags(connection, connContext): string[]` - Assign tags to a connection

### Additional Methods

- `broadcast(message, exclude = [])` - Send a message to all connections, optionally excluding some
- `getConnections(tags = [])` - Get all connections, optionally filtered by tags
- `getConnection(id)` - Get a connection by its ID

## Properties

- `.name` - (readonly) this is automatically set to the server's name, determined by `getServerByName()` or `Server.partyFetch()`.
- `.ctx` - the context object for the Durable Object, containing references to [`storage`](https://developers.cloudflare.com/durable-objects/api/transactional-storage-api/)
- `.env` - the environment object for the Durable Object, usually defined by bindings and other configuration in your `wrangler.toml` configuration file.

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

### Hibernation Option

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

- `getServerByName(namespace, name, {locationHint}): Promise<DurableObjectStub>` - Create a new Server with a specific name. Optionally pass a `locationHint` to specify the [location](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint) of the server.
- `Server.partyFetch(request, env, {locationHint, prefix = 'parties'}): Promise<Response | null>` - Match a request to a server. Takes a URL of the form `/${prefix}/:server/:name` and matches it with any namespace named `:server` (case insensitive) and a server named `:name`.
