// rethink error handling, how to pass it on to the client
// rethink oBC/oBR
// push for durable.setState (in addition to connection.setState)

import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";

import {
  createLazyConnection,
  HibernatingConnectionManager,
  InMemoryConnectionManager
} from "./connection";

import type { ConnectionManager } from "./connection";
import type {
  Connection,
  ConnectionContext,
  ConnectionSetStateFn,
  ConnectionState
} from "./types";

export * from "./types";

export type WSMessage = ArrayBuffer | ArrayBufferView | string;

// Let's cache the party namespace map
// so we don't call it on every request
const partyMapCache = new WeakMap<
  Record<string, unknown>,
  Record<string, DurableObjectNamespace>
>();

export class Party<Env> extends DurableObject<Env> {
  static options = {
    hibernate: false
  };

  /**
   * For a given party namespace, create a stub with a room name.
   */
  static async withRoom<Env, T extends Party<Env>>(
    partyNamespace: DurableObjectNamespace<T>,
    room: string,
    options?: {
      locationHint?: DurableObjectLocationHint;
    }
  ): Promise<DurableObjectStub<T>> {
    const docId = partyNamespace.idFromName(room).toString();
    const id = partyNamespace.idFromString(docId);
    const stub = partyNamespace.get(id, options);

    // TODO: fix this
    await stub.withRoom(room);
    // .catch((e) => {
    //   console.error("Could not set room name:", e);
    // });

    return stub;
  }

  /**
   * A utility function for PartyKit style routing.
   */
  static async fetchRoomForRequest<Env, T extends Party<Env>>(
    req: Request,
    env: Record<string, unknown>,
    options?: {
      locationHint?: DurableObjectLocationHint;
    }
  ): Promise<Response | null> {
    if (!partyMapCache.has(env)) {
      partyMapCache.set(
        env,
        Object.entries(env).reduce((acc, [k, v]) => {
          // @ts-expect-error - we're checking for the existence of idFromName
          if (v && "idFromName" in v && typeof v.idFromName === "function") {
            return { ...acc, [k.toLowerCase()]: v };
          }
          return acc;
        }, {})
      );
    }
    const map = partyMapCache.get(env) as Record<
      string,
      DurableObjectNamespace<T>
    >;

    const url = new URL(req.url);

    const parts = url.pathname.split("/");
    if (parts[1] === "parties" && parts.length < 4) {
      return null;
    }
    const room = parts[3],
      party = parts[2];
    if (parts[1] === "parties" && room && party) {
      if (!map[party]) {
        console.error(`The url ${req.url} does not match any party namespace. 
Did you forget to add a durable object binding to the class in your wrangler.toml?`);
      }

      const stub = await Party.withRoom(map[party], room, options); // TODO: fix this
      return stub.fetch(req);
    } else {
      return null;
    }
  }

  #status: "zero" | "starting" | "started" = "zero";
  #onStartPromise: Promise<void> | null = null;

  #connectionManager: ConnectionManager;
  #ParentClass: typeof Party;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // TODO: fix this any type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    this.#ParentClass = Object.getPrototypeOf(this).constructor;
    this.#connectionManager = this.#ParentClass.options.hibernate
      ? new HibernatingConnectionManager(ctx)
      : new InMemoryConnectionManager();

    // TODO: throw error if any of
    // broadcast/getConnection/getConnections/getConnectionTags
    // fetch/webSocketMessage/webSocketClose/webSocketError
    // have been overridden
  }

  /**
   * Handle incoming requests to the party. Don't use this, use onRequest instead
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (this.#status !== "started") {
      await this.#initialize();
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return this.onRequest(request);
    } else {
      // Create the websocket pair for the client
      const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
      let connectionId = url.searchParams.get("_pk");
      if (!connectionId) {
        connectionId = nanoid();
      }

      let connection: Connection = Object.assign(serverWebSocket, {
        id: connectionId,
        room: this.room,
        state: null as unknown as ConnectionState<unknown>,
        setState<T = unknown>(setState: T | ConnectionSetStateFn<T>) {
          let state: T;
          if (setState instanceof Function) {
            state = setState(this.state as ConnectionState<T>);
          } else {
            state = setState;
          }

          // TODO: deepFreeze object?
          this.state = state as ConnectionState<T>;
          return this.state;
        }
      });

      const ctx = { request };

      const tags = await this.getConnectionTags(connection, ctx);

      // Accept the websocket connection
      connection = this.#connectionManager.accept(connection, {
        tags,
        room: this.room
      });

      if (!this.#ParentClass.options.hibernate) {
        this.#attachSocketEventHandlers(connection);
      }
      await this.onConnect(connection, ctx);

      return new Response(null, { status: 101, webSocket: clientWebSocket });
    }
  }

  async webSocketMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const connection = createLazyConnection(ws);
    if (this.#status !== "started") {
      // This means the room "woke up" after hibernation
      // so we need to hydrate this.room again
      await this.#initialize();
    }

    return this.onMessage(connection, message);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    const connection = createLazyConnection(ws);
    if (this.#status !== "started") {
      // This means the room "woke up" after hibernation
      // so we need to hydrate this.room again
      await this.#initialize();
    }
    return this.onClose(connection, code, reason, wasClean);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connection = createLazyConnection(ws);
    if (this.#status !== "started") {
      // This means the room "woke up" after hibernation
      // so we need to hydrate this.room again
      await this.#initialize();
    }
    return this.onError(connection, error);
  }

  async #initialize(): Promise<void> {
    if (!this.#_room) {
      throw new Error(
        "This party's room name has not been set, did you forget to call withRoom?"
      );
    }
    switch (this.#status) {
      case "zero": {
        this.#status = "starting";
        const maybeOnStartPromise = this.onStart();
        if (maybeOnStartPromise instanceof Promise) {
          this.#onStartPromise = maybeOnStartPromise;
          await this.#onStartPromise;
          this.#onStartPromise = null;
        }
        this.#status = "started";
        break;
      }
      case "starting":
        await this.#onStartPromise;
        break;
      case "started":
        break;
    }
  }

  #attachSocketEventHandlers(connection: Connection) {
    const handleMessageFromClient = (event: MessageEvent) => {
      this.onMessage(connection, event.data)?.catch<void>((e) => {
        console.error("onMessage error:", e);
      });
    };

    const handleCloseFromClient = (event: CloseEvent) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("close", handleCloseFromClient);
      this.onClose(connection, event.code, event.reason, event.wasClean)?.catch(
        (e) => {
          console.error("onClose error:", e);
        }
      );
    };

    const handleErrorFromClient = (e: ErrorEvent) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("error", handleErrorFromClient);
      this.onError(connection, e.error)?.catch((e) => {
        console.error("onError error:", e);
      });
    };

    connection.addEventListener("close", handleCloseFromClient);
    connection.addEventListener("error", handleErrorFromClient);
    connection.addEventListener("message", handleMessageFromClient);
  }

  // Public API

  #_room: string | undefined;
  /**
   * The room name for this party. Read-only.
   */
  get room(): string {
    if (!this.#_room) {
      throw new Error(
        "This party has not been initialised yet, did you forget to call withRoom?"
      );
    }
    return this.#_room;
  }

  // We won't have an await inside this function
  // but it will be called remotely,
  // so we need to mark it as async
  // eslint-disable-next-line @typescript-eslint/require-await
  async withRoom(room: string) {
    if (!room) {
      throw new Error("Room name is required.");
    }
    if (this.#_room && this.#_room !== room) {
      throw new Error("Room has already been set for this party.");
    }
    this.#_room = room;
  }

  /** Send a message to all connected clients, except connection ids listed in `without` */
  broadcast(
    msg: string | ArrayBuffer | ArrayBufferView,
    without?: string[] | undefined
  ): void {
    for (const connection of this.#connectionManager.getConnections()) {
      if (!without || !without.includes(connection.id)) {
        connection.send(msg);
      }
    }
  }

  /** Get a connection by connection id */
  getConnection<TState = unknown>(id: string): Connection<TState> | undefined {
    return this.#connectionManager.getConnection<TState>(id);
  }

  /**
   * Get all connections. Optionally, you can provide a tag to filter returned connections.
   * Use `Party.Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections<TState = unknown>(tag?: string): Iterable<Connection<TState>> {
    return this.#connectionManager.getConnections<TState>(tag);
  }

  /**
   * You can tag a connection to filter them in Party#getConnections.
   * Each connection supports up to 9 tags, each tag max length is 256 characters.
   */
  getConnectionTags(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ConnectionContext
  ): string[] | Promise<string[]> {
    return [];
  }

  // Implemented by the user

  /**
   * Called when the party is started for the first time.
   */
  onStart(): void | Promise<void> {}

  /**
   * Called when a new connection is made to the party.
   */
  onConnect(
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ConnectionContext
  ): void | Promise<void> {
    console.warn(
      `Connection ${connection.id} connected to ${this.#ParentClass.name}:${this.room}, but no onConnect handler was implemented.`
    );
  }

  /**
   * Called when a message is received from a connection.
   */
  onMessage(
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    message: WSMessage
  ): void | Promise<void> {
    console.warn(
      `Recieved message on connection ${this.#ParentClass.name}:${connection.id}, but no onMessage handler was implemented.`
    );
  }

  /**
   * Called when a connection is closed.
   */
  onClose(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    code: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reason: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    wasClean: boolean
  ): void | Promise<void> {}

  /**
   * Called when an error occurs on a connection.
   */
  onError(connection: Connection, error: unknown): void | Promise<void> {
    console.error(
      `Error on connection ${connection.id} in ${this.#ParentClass.name}:${this.room}:`,
      error
    );
  }

  /**
   * Called when a request is made to the party.
   */
  onRequest(request: Request): Response | Promise<Response> {
    // default to 404
    return new Response(
      `onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.room} responding to ${request.url}`,
      { status: 404 }
    );
  }
}
