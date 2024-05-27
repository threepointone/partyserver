// https://stackoverflow.com/a/58993872
type ImmutablePrimitive = undefined | null | boolean | string | number;
type Immutable<T> = T extends ImmutablePrimitive
  ? T
  : T extends Array<infer U>
    ? ImmutableArray<U>
    : T extends Map<infer K, infer V>
      ? ImmutableMap<K, V>
      : T extends Set<infer M>
        ? ImmutableSet<M>
        : ImmutableObject<T>;
type ImmutableArray<T> = ReadonlyArray<Immutable<T>>;
type ImmutableMap<K, V> = ReadonlyMap<Immutable<K>, Immutable<V>>;
type ImmutableSet<T> = ReadonlySet<Immutable<T>>;
type ImmutableObject<T> = { readonly [K in keyof T]: Immutable<T[K]> };

export type ConnectionState<T> = ImmutableObject<T> | null;
export type ConnectionSetStateFn<T> = (prevState: ConnectionState<T>) => T;

export type ConnectionContext = {
  request: Request;
};

/** A WebSocket connected to the Room */
export type Connection<TState = unknown> = WebSocket & {
  /** Connection identifier */
  id: string;

  /**
   * Arbitrary state associated with this connection.
   * Read-only, use Connection.setState to update the state.
   */
  state: ConnectionState<TState>;

  setState(
    state: TState | ConnectionSetStateFn<TState> | null
  ): ConnectionState<TState>;

  /** @deprecated use Connection.setState instead */
  serializeAttachment<T = unknown>(attachment: T): void;

  /** @deprecated use Connection.state instead */
  deserializeAttachment<T = unknown>(): T | null;

  /**
   * Room name
   */
  room: string;
};

export interface Room {
  /** Room ID defined in the Party URL, e.g. /parties/:name/:id */
  id: string;

  /** Internal ID assigned by the platform. Use Party.id instead. */
  internalID: string;

  /** Send a message to all connected clients, except connection ids listed `without` */
  broadcast: (
    msg: string | ArrayBuffer | ArrayBufferView,
    without?: string[] | undefined
  ) => void;

  /** Get a connection by connection id */
  getConnection<TState = unknown>(id: string): Connection<TState> | undefined;

  /**
   * Get all connections. Optionally, you can provide a tag to filter returned connections.
   * Use `Party.Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections<TState = unknown>(tag?: string): Iterable<Connection<TState>>;
}
