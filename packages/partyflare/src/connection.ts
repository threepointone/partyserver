// Polyfill WebSocket status code constants for environments that don't have them
// in order to support libraries that expect standards-compatible WebSocket

import type {
  Connection,
  ConnectionSetStateFn,
  ConnectionState
} from "./types";

// implementations (e.g. PartySocket)
if (!("OPEN" in WebSocket)) {
  const WebSocketStatus = {
    CONNECTING: WebSocket.READY_STATE_CONNECTING,
    OPEN: WebSocket.READY_STATE_OPEN,
    CLOSING: WebSocket.READY_STATE_CLOSING,
    CLOSED: WebSocket.READY_STATE_CLOSED
  };

  Object.assign(WebSocket, WebSocketStatus);
  Object.assign(WebSocket.prototype, WebSocketStatus);
}

/**
 * Store both platform attachments and user attachments in different namespaces
 */
type ConnectionAttachments = {
  __pk: {
    id: string;
    // TODO: remove this once we have
    // durable object level setState
    room: string;
  };
  __user?: unknown;
};

/**
 * Cache websocket attachments to avoid having to rehydrate them on every property access.
 */
class AttachmentCache {
  #cache = new WeakMap<WebSocket, ConnectionAttachments>();

  get(ws: WebSocket): ConnectionAttachments {
    let attachment = this.#cache.get(ws);
    if (!attachment) {
      attachment = WebSocket.prototype.deserializeAttachment.call(
        ws
      ) as ConnectionAttachments;
      if (attachment !== undefined) {
        this.#cache.set(ws, attachment);
      } else {
        throw new Error(
          "Missing websocket attachment. This is most likely an issue in PartyFlare, please open an issue at https://github.com/threepointone/partyflare/issues"
        );
      }
    }

    return attachment;
  }

  set(ws: WebSocket, attachment: ConnectionAttachments) {
    this.#cache.set(ws, attachment);
    WebSocket.prototype.serializeAttachment.call(ws, attachment);
  }
}

const attachments = new AttachmentCache();
const connections = new WeakSet<Connection>();
const isWrapped = (ws: WebSocket): ws is Connection => {
  return connections.has(ws as Connection);
};

/**
 * Wraps a WebSocket with PartyConnection fields that rehydrate the
 * socket attachments lazily only when requested.
 */
export const createLazyConnection = (
  ws: WebSocket | Connection
): Connection => {
  if (isWrapped(ws)) {
    return ws;
  }

  // if state was set on the socket before initializing the connection,
  // capture it here so we can persist it again
  let initialState = undefined;
  if ("state" in ws) {
    initialState = ws.state;
    delete ws.state;
  }

  const connection = Object.defineProperties(ws, {
    id: {
      get() {
        return attachments.get(ws).__pk.id;
      }
    },
    room: {
      get() {
        return attachments.get(ws).__pk.room;
      }
    },
    socket: {
      get() {
        return ws;
      }
    },
    state: {
      get() {
        return ws.deserializeAttachment() as ConnectionState<unknown>;
      }
    },
    setState: {
      value: function setState<T>(setState: T | ConnectionSetStateFn<T>) {
        let state: T;
        if (setState instanceof Function) {
          state = setState((this as Connection<T>).state);
        } else {
          state = setState;
        }

        ws.serializeAttachment(state);
        return state as ConnectionState<T>;
      }
    },

    deserializeAttachment: {
      value: function deserializeAttachment<T = unknown>() {
        const attachment = attachments.get(ws);
        return (attachment.__user ?? null) as T;
      }
    },

    serializeAttachment: {
      value: function serializeAttachment<T = unknown>(attachment: T) {
        const setting = {
          ...attachments.get(ws),
          __user: attachment ?? null
        };

        attachments.set(ws, setting);
      }
    }
  }) as Connection;

  if (initialState) {
    connection.setState(initialState);
  }

  connections.add(connection);
  return connection;
};

class HibernatingConnectionIterator<T>
  implements IterableIterator<Connection<T>>
{
  private index: number = 0;
  private sockets: WebSocket[] | undefined;
  constructor(
    private state: DurableObjectState,
    private tag?: string
  ) {}

  [Symbol.iterator](): IterableIterator<Connection<T>> {
    return this;
  }

  next(): IteratorResult<Connection<T>, number | undefined> {
    const sockets =
      this.sockets ?? (this.sockets = this.state.getWebSockets(this.tag));

    let socket: WebSocket;
    while ((socket = sockets[this.index++])) {
      // only yield open sockets to match non-hibernating behaviour
      if (socket.readyState === WebSocket.READY_STATE_OPEN) {
        const value = createLazyConnection(socket) as Connection<T>;
        return { done: false, value };
      }
    }

    // reached the end of the iteratee
    return { done: true, value: undefined };
  }
}

export interface ConnectionManager {
  getCount(): number;
  getConnection<TState>(id: string): Connection<TState> | undefined;
  getConnections<TState>(tag?: string): IterableIterator<Connection<TState>>;
  accept(
    connection: Connection,
    options: { tags: string[]; room: string }
  ): Connection;

  // This can be removed when connections is removed
  legacy_getConnectionMap(): Map<string, Connection>;
}

/**
 * When not using hibernation, we track active connections manually.
 */
export class InMemoryConnectionManager<TState> implements ConnectionManager {
  connections: Map<string, Connection> = new Map();
  tags: WeakMap<Connection, string[]> = new WeakMap();

  getCount() {
    return this.connections.size;
  }

  getConnection<T = TState>(id: string) {
    return this.connections.get(id) as Connection<T> | undefined;
  }

  *getConnections<T = TState>(tag?: string): IterableIterator<Connection<T>> {
    if (!tag) {
      yield* this.connections.values() as IterableIterator<Connection<T>>;
      return;
    }

    // simulate DurableObjectState.getWebSockets(tag) behaviour
    for (const connection of this.connections.values()) {
      const connectionTags = this.tags.get(connection) ?? [];
      if (connectionTags.includes(tag)) {
        yield connection as Connection<T>;
      }
    }
  }

  legacy_getConnectionMap() {
    return this.connections;
  }

  accept(connection: Connection, options: { tags: string[]; room: string }) {
    connection.accept();

    this.connections.set(connection.id, connection);
    this.tags.set(connection, [
      // make sure we have id tag
      connection.id,
      ...options.tags.filter((t) => t !== connection.id)
    ]);

    const removeConnection = () => {
      this.connections.delete(connection.id);
      connection.removeEventListener("close", removeConnection);
      connection.removeEventListener("error", removeConnection);
    };
    connection.addEventListener("close", removeConnection);
    connection.addEventListener("error", removeConnection);

    return connection;
  }
}

/**
 * When opting into hibernation, the platform tracks connections for us.
 */
export class HibernatingConnectionManager<TState> implements ConnectionManager {
  constructor(private controller: DurableObjectState) {}

  getCount() {
    return Number(this.controller.getWebSockets().length);
  }

  getConnection<T = TState>(id: string) {
    // TODO: Should we cache the connections?
    const sockets = this.controller.getWebSockets(id);
    if (sockets.length === 0) return undefined;
    if (sockets.length === 1)
      return createLazyConnection(sockets[0]) as Connection<T>;

    throw new Error(
      `More than one connection found for id ${id}. Did you mean to use getConnections(tag) instead?`
    );
  }

  getConnections<T = TState>(tag?: string | undefined) {
    return new HibernatingConnectionIterator<T>(this.controller, tag);
  }

  legacy_getConnectionMap() {
    const connections = new Map();
    for (const connection of this.getConnections()) {
      connections.set(connection.id, connection);
    }
    return connections;
  }

  accept(connection: Connection, options: { tags: string[]; room: string }) {
    // dedupe tags in case user already provided id tag
    const tags = [
      connection.id,
      ...options.tags.filter((t) => t !== connection.id)
    ];

    // validate tags against documented restrictions
    // shttps://developers.cloudflare.com/durable-objects/api/hibernatable-websockets-api/#state-methods-for-websockets
    if (tags.length > 10) {
      throw new Error(
        "A connection can only have 10 tags, including the default id tag."
      );
    }

    for (const tag of tags) {
      if (typeof tag !== "string") {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`A connection tag must be a string. Received: ${tag}`);
      }
      if (tag === "") {
        throw new Error(`A connection tag must not be an empty string.`);
      }
      if (tag.length > 256) {
        throw new Error(`A connection tag must not exceed 256 characters`);
      }
    }

    this.controller.acceptWebSocket(connection, tags);
    connection.serializeAttachment({
      __pk: {
        id: connection.id,
        room: options.room
      },
      __user: null
    });

    return createLazyConnection(connection);
  }
}
