> [!CAUTION]
> Experimental early work, not recommended for production use.

## partyflare

A lightweight api for durable objects, inspired by [PartyKit](https://www.partykit.io/).

```shell
npm install partyflare
```

```ts
import { Party } from "partyflare";

// define any durable objects you want to use
export class MyParty extends Party {
  onConnect(connection) {
    console.log("connected", connection.id, "to room", this.room);
  }
  onMessage(connection, message) {
    console.log("message", connection.id, message);
    // send the message to all connections
    this.broadcast(
      message,
      /* optionally exclude any connections that shouldn't recieve the message */
      [connection.id]
    );
  }
}

export default {
  // setup your fetch handler to use configured parties
  fetch(request, env) {
    return (
      Party.fetchRoomForRequest(req, env) ||
      new Response("Not Found", { status: 404 })
    );
  }
};
```

## Overrides on `Party`

You can override the following methods on `Party` to add custom behavior:

### Lifecycle hooks: (all optionally `async`)

- `onStart()` - when the party is started for the first time (or or waking up after hibernating)
- `onConnect(connection, connContext)` - when a new connection is established
- `onMessage(connection, message)` - when a message is received from a connection
- `onClose(connection, code, reason, wasClean)` - when a connection is closed
- `onError(error)` - when an error occurs on a connection
- `onRequest(request): Response` - when a request is received from the fetch handler
- `getConnectionTags(connection, connContext)` - return an array of tags for a connection

### Other methods:

- `broadcast(message, exclude = [])` - send a message to all connections, optionally excluding some
- `getConnections(tags = [])` - get all connections (optionally with the given tags)
- `getConnection(id)` - get a connection by id

### Party::room

The `room` property is automatically set to the room name, determined by `Party.withRoom()`/`Party.fetchRoomForRequest()`.

### Party.options.hibernate

You can enable [hibernation](https://developers.cloudflare.com/durable-objects/reference/websockets/#websocket-hibernation) by passing a static `options` property on your party class. This will allow the party to be hibernated when it is not in use, and woken up when a new connection is established. All your lifecycle hooks will be called as expected when the party is woken up.

```ts
export class MyParty extends Party {
  static options = {
    hibernate: true
  };
  // ...
}
```

### `Party.withRoom(namespace, room, {locationHint})`

This is a utility method to create a new party class with a specific room name. It returns a DurableObjectStub that you can call further methods on, including `.fetch()`. You can optionally pass a `locationHint` to [specify the location of the party](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint).

### `Party.fetchRoomForRequest(request, env, {locationHint})`

This is a utility method to match a request to a party class (ala PartyKit). It takes a url of form `/parties/:party/:room` and matches it with any namespace named `:party` (case insensitive) with a room name of `:room`.
