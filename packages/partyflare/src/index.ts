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

// Let's cache the server namespace map
// so we don't call it on every request
const serverMapCache = new WeakMap<
  Record<string, unknown>,
  Record<string, DurableObjectNamespace>
>();

/**
 * For a given server namespace, create a server with a name.
 */
export async function getServerByName<Env, T extends Server<Env>>(
  serverNamespace: DurableObjectNamespace<T>,
  name: string,
  options?: {
    locationHint?: DurableObjectLocationHint;
  }
): Promise<DurableObjectStub<T>> {
  const docId = serverNamespace.idFromName(name).toString();
  const id = serverNamespace.idFromString(docId);
  const stub = serverNamespace.get(id, options);

  // TODO: fix this
  await stub.setName(name);
  // .catch((e) => {
  //   console.error("Could not set server name:", e);
  // });

  return stub;
}

export class Server<Env> extends DurableObject<Env> {
  static options = {
    hibernate: false
  };

  /**
   * A utility function for PartyKit style routing.
   */
  static async partyFetch<Env, T extends Server<Env>>(
    req: Request,
    env: Record<string, unknown>,
    options?: {
      locationHint?: DurableObjectLocationHint;
    }
  ): Promise<Response | null> {
    if (!serverMapCache.has(env)) {
      serverMapCache.set(
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
    const map = serverMapCache.get(env) as Record<
      string,
      DurableObjectNamespace<T>
    >;

    const url = new URL(req.url);

    const parts = url.pathname.split("/");
    if (parts[1] === "parties" && parts.length < 4) {
      return null;
    }
    const name = parts[3],
      namespace = parts[2];
    if (parts[1] === "parties" && name && namespace) {
      if (!map[namespace]) {
        console.error(`The url ${req.url} does not match any server namespace. 
Did you forget to add a durable object binding to the class in your wrangler.toml?`);
      }

      const stub = await getServerByName(map[namespace], name, options); // TODO: fix this
      return stub.fetch(req);
    } else {
      return null;
    }
  }

  #status: "zero" | "starting" | "started" = "zero";
  #onStartPromise: Promise<void> | null = null;

  #connectionManager: ConnectionManager;
  #ParentClass: typeof Server;

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
   * Handle incoming requests to the server.
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
        server: this.name,
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
        server: this.name
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
      // This means the server "woke up" after hibernation
      // so we need to hydrate it again
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
      // This means the server "woke up" after hibernation
      // so we need to hydrate it again
      await this.#initialize();
    }
    return this.onClose(connection, code, reason, wasClean);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connection = createLazyConnection(ws);
    if (this.#status !== "started") {
      // This means the server "woke up" after hibernation
      // so we need to hydrate it again
      await this.#initialize();
    }
    return this.onError(connection, error);
  }

  async #initialize(): Promise<void> {
    if (!this.#_name) {
      throw new Error(
        "This server's name has not been set, did you forget to call withName?"
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

  #_name: string | undefined;
  /**
   * The name for this server. Read-only.
   */
  get name(): string {
    if (!this.#_name) {
      throw new Error(
        "This server has not been initialised yet, did you forget to call withName?"
      );
    }
    return this.#_name;
  }

  // We won't have an await inside this function
  // but it will be called remotely,
  // so we need to mark it as async
  // eslint-disable-next-line @typescript-eslint/require-await
  async setName(name: string) {
    if (!name) {
      throw new Error("A name is required.");
    }
    if (this.#_name && this.#_name !== name) {
      throw new Error("This server already has a name.");
    }
    this.#_name = name;
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
   * Use `Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections<TState = unknown>(tag?: string): Iterable<Connection<TState>> {
    return this.#connectionManager.getConnections<TState>(tag);
  }

  /**
   * You can tag a connection to filter them in Server#getConnections.
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
   * Called when the server is started for the first time.
   */
  onStart(): void | Promise<void> {}

  /**
   * Called when a new connection is made to the server.
   */
  onConnect(
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ConnectionContext
  ): void | Promise<void> {
    console.warn(
      `Connection ${connection.id} connected to ${this.#ParentClass.name}:${this.name}, but no onConnect handler was implemented.`
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
      `Error on connection ${connection.id} in ${this.#ParentClass.name}:${this.name}:`,
      error
    );
  }

  /**
   * Called when a request is made to the server.
   */
  onRequest(request: Request): Response | Promise<Response> {
    // default to 404
    return new Response(
      `onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.name} responding to ${request.url}`,
      { status: 404 }
    );
  }
}
