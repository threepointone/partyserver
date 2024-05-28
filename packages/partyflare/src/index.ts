// rethink error handling, how to pass it on to the client
// rethink alarms usage
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export type WSMessage = ArrayBuffer | ArrayBufferView | string;

function getPartyAndRoomFromUrl(url: URL) {
  // /parties/:party/:name
  const parts = url.pathname.split("/");
  if (parts[1] === "parties" && parts.length < 4) {
    return null;
  }
  const room = parts[3],
    party = parts[2];
  if (parts[1] === "parties" && room && party) {
    return {
      room,
      party
    };
  }

  if (parts[1] === "party" && parts.length < 3) {
    return null;
  }
  const room2 = parts[2],
    party2 = "main";
  if (parts[1] === "party" && room2 && party2) {
    return {
      room: room2,
      party: party2
    };
  }

  return null;
}

export class Party<Env> extends DurableObject<Env> {
  static options = {
    hibernate: false
  };
  static async match(
    req: Request,
    env: Record<string, unknown>,
    partyMap?:
      | Record<string, DurableObjectNamespace>
      | ((
          req: Request,
          env: Record<string, unknown>
        ) => { room: string; party: DurableObjectNamespace } | null)
  ): Promise<Response | null> {
    if (typeof partyMap === "function") {
      const roomDetails = partyMap(req, env);
      if (!roomDetails) {
        return null;
      } else {
        const { room, party } = roomDetails;
        const docId = party.idFromName(room).toString();
        const id = party.idFromString(docId);
        const stub = party.get(id);
        const headers = new Headers(req.headers);
        headers.set("x-partyflare-room", room);
        return stub.fetch(req, {
          headers
        });
      }
    }

    const map: Record<string, DurableObjectNamespace> =
      partyMap ||
      Object.entries(env).reduce((acc, [k, v]) => {
        // @ts-expect-error - we're checking for the existence of idFromName
        if (v && "idFromName" in v && typeof v.idFromName === "function") {
          return { ...acc, [k.toLowerCase()]: v };
        }
        return acc;
      }, {});

    const roomDetails = getPartyAndRoomFromUrl(new URL(req.url));
    if (!roomDetails) {
      return null;
    } else {
      const { room, party } = roomDetails;
      const docId = map[party].idFromName(room).toString();
      const id = map[party].idFromString(docId);
      const stub = map[party].get(id);
      const headers = new Headers(req.headers);
      headers.set("x-partyflare-room", room);
      return stub.fetch(req, {
        headers
      });
    }
  }

  #status: "zero" | "starting" | "started" = "zero";

  onStartPromise: Promise<void> | null = null;

  connectionManager: ConnectionManager;
  ParentClass: typeof Party;

  #_room: string | undefined;
  get room(): string {
    if (!this.#_room) {
      throw new Error("This party has not been initialised yet.");
    }
    return this.#_room;
  }
  set room(room: string) {
    this.#_room = room;
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ParentClass = Object.getPrototypeOf(this).constructor;
    this.connectionManager = this.ParentClass.options.hibernate
      ? new HibernatingConnectionManager(ctx)
      : new InMemoryConnectionManager();

    // TODO: throw error if any of
    // broadcast/getConnection/getConnections/getConnectionTags
    // have been overridden
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (this.#status !== "started") {
      await this.#initializeFromRequest(request);
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return this.onRequest(request);
    } else {
      if (
        this.onConnect === Party.prototype.onConnect &&
        this.onMessage === Party.prototype.onMessage
      ) {
        throw new Error(
          "You must implement onConnect or onMessage in your Party subclass"
        );
      }
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
      connection = this.connectionManager.accept(connection, {
        tags,
        room: this.room
      });

      if (!this.ParentClass.options.hibernate) {
        await this.#attachSocketEventHandlers(connection);
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
      // assert(connection.uri, "No uri found in connection");
      await this.#initializeFromConnection(connection);
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
      // assert(connection.uri, "No uri found in connection");
      await this.#initializeFromConnection(connection);
    }
    return this.onClose(connection, code, reason, wasClean);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connection = createLazyConnection(ws);
    if (this.#status !== "started") {
      // This means the room "woke up" after hibernation
      // so we need to hydrate this.room again
      // assert(connection.uri, "No uri found in connection");
      await this.#initializeFromConnection(connection);
    }
    return this.onError(connection, error);
  }

  async #initialize(): Promise<void> {
    switch (this.#status) {
      case "zero": {
        this.#status = "starting";
        const maybeOnStartPromise = this.onStart();
        if (maybeOnStartPromise instanceof Promise) {
          this.onStartPromise = maybeOnStartPromise;
          await this.onStartPromise;
        }
        this.#status = "started";
        break;
      }
      case "starting":
        await this.onStartPromise;
        break;
      case "started":
        break;
    }
  }

  async #initializeFromRequest(req: Request) {
    const room = this.#getRoomFromRequest(req);
    assert(room, "No room details found in request");
    this.room = room;
    await this.#initialize();
  }

  async #initializeFromConnection(connection: Connection) {
    const room = this.#getRoomFromConnection(connection);
    assert(room, "No room details found in connection");
    this.room = room;
    await this.#initialize();
  }

  async #attachSocketEventHandlers(connection: Connection) {
    // assert(this.worker, "[onConnect] Worker not initialized.");

    const handleMessageFromClient = (event: MessageEvent) => {
      this.onMessage(connection, event.data)?.catch((e) => {
        console.error(e);
      });
    };

    const handleCloseFromClient = (event: CloseEvent) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("close", handleCloseFromClient);
      this.onClose(connection, event.code, event.reason, event.wasClean)?.catch(
        (e) => {
          console.error(e);
        }
      );
    };

    const handleErrorFromClient = (e: ErrorEvent) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("error", handleErrorFromClient);
      this.onError(connection, e.error)?.catch((e) => {
        console.error(e);
      });
    };

    connection.addEventListener("close", handleCloseFromClient);
    connection.addEventListener("error", handleErrorFromClient);
    connection.addEventListener("message", handleMessageFromClient);
  }

  /** Send a message to all connected clients, except connection ids listed `without` */
  broadcast(
    msg: string | ArrayBuffer | ArrayBufferView,
    without?: string[] | undefined
  ): void {
    for (const connection of this.connectionManager.getConnections()) {
      if (!without || !without.includes(connection.id)) {
        connection.send(msg);
      }
    }
  }

  /** Get a connection by connection id */
  getConnection<TState = unknown>(id: string): Connection<TState> | undefined {
    return this.connectionManager.getConnection<TState>(id);
  }

  /**
   * Get all connections. Optionally, you can provide a tag to filter returned connections.
   * Use `Party.Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections<TState = unknown>(tag?: string): Iterable<Connection<TState>> {
    return this.connectionManager.getConnections<TState>(tag);
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

  // implemented by the user
  onStart(): void | Promise<void> {}
  onConnect(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ConnectionContext
  ): void | Promise<void> {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {}
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onError(connection: Connection, error: unknown): void | Promise<void> {}
  onRequest(request: Request): Response | Promise<Response> {
    // default to 404
    return new Response(
      `onRequest hasn't been implemented on the Durable Object responding to ${request.url}`,
      { status: 404 }
    );
  }

  #getRoomFromRequest(req: Request): string {
    // get the room from the request
    // headers: x-partyflare-room

    const room = req.headers.get("x-partyflare-room");

    if (!room) {
      throw new Error("x-partyflare-room header not found in request");
    }

    return room;
  }
  #getRoomFromConnection(connection: Connection): string {
    const { room } = connection;
    if (!room) {
      throw new Error("Room not found in connection");
    }
    return room;
  }
}
