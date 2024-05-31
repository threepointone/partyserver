# partyflare

A lightweight API for durable objects, inspired by [PartyKit](https://www.partykit.io/).

> [!CAUTION]
> This project is in its experimental early stages and is not recommended for production use.

## Installation

To install partyflare, run the following command:

```shell
npm install partyflare
```

## Why Use Partyflare?

Partyflare enhances durable objects with the following features:

- Simple room-based routing
- Lifecycle hooks for connections and requests
- A unified API for managing hibernated and non-hibernated durable objects
- Easy broadcasting to all or selected connections in a room

## Limitations

- Always uses `idFromName` for routing
- Additional features and improvements are planned (TODO)

## Usage

Here's an example of how to use partyflare:

```ts
import { Party } from "partyflare";

// Define your durable objects
export class MyParty extends Party {
  onConnect(connection) {
    console.log("Connected", connection.id, "to room", this.room);
  }

  onMessage(connection, message) {
    console.log("Message from", connection.id, ":", message);
    // Send the message to every other connection
    this.broadcast(message, [connection.id]);
  }
}

export default {
  // Set up your fetch handler to use configured parties
  fetch(request, env) {
    return (
      Party.fetchRoomForRequest(request, env) ||
      new Response("Not Found", { status: 404 })
    );
  }
};
```

## Customizing `Party`

You can override the following methods on `Party` to add custom behavior:

### Lifecycle Hooks

These methods can be optionally `async`:

- `onStart()` - Called when the party starts for the first time or after waking up from hibernation
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

### Connection Properties

A connection is a standard WebSocket with the following additional properties:

- `id` - A unique ID for the connection
- `tags` - An array of tags assigned to the connection (TODO)
- `room` - The room name the connection is in
- `state` - Arbitrary state data (up to 2KB) that can be set on the connection using `connection.setState()`

### `.room`

The `room` property is automatically set to the room name, determined by `Party.withRoom()` or `Party.fetchRoomForRequest()`.

### Hibernation Option

You can enable [hibernation](https://developers.cloudflare.com/durable-objects/reference/websockets/#websocket-hibernation) by setting a static `options` property on your party class. This allows the party to hibernate when not in use and wake up when a new connection is established. All lifecycle hooks will be called as expected when the party wakes up.

```ts
export class MyParty extends Party {
  static options = {
    hibernate: true
  };
  // ...
}
```

### Utility Methods

- `Party.withRoom(namespace, room, {locationHint}): Promise<DurableObjectStub>` - Create a new party class with a specific room name. Returns a DurableObjectStub for further methods, including `.fetch()`. Optionally pass a `locationHint` to specify the location of the party.
- `Party.fetchRoomForRequest(request, env, {locationHint}): Promise<Response | null>` - Match a request to a party class. Takes a URL of the form `/parties/:party/:room` and matches it with any namespace named `:party` (case insensitive) and room name `:room`.
