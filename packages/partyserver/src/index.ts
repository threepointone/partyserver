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
  const id = serverNamespace.idFromName(name);
  const stub = serverNamespace.get(id, options);

  // TODO: fix this
  await stub.setName(name);
  // .catch((e) => {
  //   console.error("Could not set server name:", e);
  // });

  return stub;
}

/**
 * A utility function for PartyKit style routing.
 */
export async function routePartykitRequest<Env, T extends Server<Env>>(
  req: Request,
  env: Record<string, unknown>,
  options?: {
    prefix?: string;
    locationHint?: DurableObjectLocationHint;
  }
): Promise<Response | null> {
  if (!serverMapCache.has(env)) {
    serverMapCache.set(
      env,
      Object.entries(env).reduce((acc, [k, v]) => {
        if (
          v &&
          typeof v === "object" &&
          "idFromName" in v &&
          typeof v.idFromName === "function"
        ) {
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

  const prefix = options?.prefix || "parties";

  const url = new URL(req.url);

  const parts = url.pathname.split("/");
  if (parts[1] === prefix && parts.length < 4) {
    return null;
  }
  const name = parts[3],
    namespace = parts[2];
  if (parts[1] === prefix && name && namespace) {
    if (!map[namespace]) {
      console.error(`The url ${req.url} does not match any server namespace. 
Did you forget to add a durable object binding to the class in your wrangler.toml?`);
    }

    const id = map[namespace].idFromName(name);
    const stub = map[namespace].get(id, options);

    // const stub = await getServerByName(map[namespace], name, options); // TODO: fix this
    // make a new request with additional headers

    req = new Request(req);
    req.headers.set("x-partykit-room", name);
    req.headers.set("x-partykit-namespace", namespace);

    return stub.fetch(req);
  } else {
    return null;
  }
}

export class Server<Env> extends DurableObject<Env> {
  static options = {
    hibernate: false
  };

  #status: "zero" | "starting" | "started" = "zero";

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  #ParentClass: typeof Server = Object.getPrototypeOf(this).constructor;

  #connectionManager: ConnectionManager = this.#ParentClass.options.hibernate
    ? new HibernatingConnectionManager(this.ctx)
    : new InMemoryConnectionManager();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx
      .blockConcurrencyWhile(async () => {
        await this.#initialize();
      })
      .catch((e) => {
        console.error(`Error while initilaizing ${this.#ParentClass.name}:`, e);
      });

    // TODO: throw error if any of
    // broadcast/getConnection/getConnections/getConnectionTags
    // fetch/webSocketMessage/webSocketClose/webSocketError
    // have been overridden
  }

  /**
   * Handle incoming requests to the server.
   */
  async fetch(request: Request): Promise<Response> {
    {
      // This is temporary while we solve https://github.com/cloudflare/workerd/issues/2240

      // get namespace and room from headers
      const namespace = request.headers.get("x-partykit-namespace");
      const room = request.headers.get("x-partykit-room");
      if (!namespace || !room) {
        throw new Error("Missing namespace or room headers");
      }
      await this.setName(room);
    }

    const url = new URL(request.url);

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

    // rehydrate the server name if it's wiken up
    await this.setName(connection.server);
    // TODO: ^ this shouldn't be async

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

    // rehydrate the server name if it's wiken up
    await this.setName(connection.server);
    // TODO: ^ this shouldn't be async

    if (this.#status !== "started") {
      // This means the server "woke up" after hibernation
      // so we need to hydrate it again
      await this.#initialize();
    }
    return this.onClose(connection, code, reason, wasClean);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connection = createLazyConnection(ws);

    // rehydrate the server name if it's wiken up
    await this.setName(connection.server);
    // TODO: ^ this shouldn't be async

    if (this.#status !== "started") {
      // This means the server "woke up" after hibernation
      // so we need to hydrate it again
      await this.#initialize();
    }
    return this.onError(connection, error);
  }

  async #initialize(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      this.#status = "starting";
      await this.onStart();
      this.#status = "started";
    });
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

  #_longErrorAboutNameThrown = false;
  /**
   * The name for this server. Write-once-only.
   */
  get name(): string {
    if (!this.#_name) {
      if (!this.#_longErrorAboutNameThrown) {
        this.#_longErrorAboutNameThrown = true;
        throw new Error(
          `Attempting to read .name on ${this.#ParentClass.name} before it was set. The name can be set by explicitly calling .setName(name) on the stub, or by using routePartyKitRequest(). This is a known issue and will be fixed soon. Follow https://github.com/cloudflare/workerd/issues/2240 for more updates.`
        );
      } else {
        throw new Error(
          `Attempting to read .name on ${this.#ParentClass.name} before it was set.`
        );
      }
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
    console.log(
      `Connection ${connection.id} connected to ${this.#ParentClass.name}:${this.name}`
    );
    // console.log(
    //   `Implement onConnect on ${this.#ParentClass.name} to handle websocket connections.`
    // );
  }

  /**
   * Called when a message is received from a connection.
   */
  onMessage(
    connection: Connection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    message: WSMessage
  ): void | Promise<void> {
    console.log(
      `Received message on connection ${this.#ParentClass.name}:${connection.id}`
    );
    console.info(
      `Implement onMessage on ${this.#ParentClass.name} to handle this message.`
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
    console.info(
      `Implement onError on ${this.#ParentClass.name} to handle this error.`
    );
  }

  /**
   * Called when a request is made to the server.
   */
  onRequest(request: Request): Response | Promise<Response> {
    // default to 404

    console.warn(
      `onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.name} responding to ${request.url}`
    );

    return new Response(`Not implemented`, { status: 404 });
  }
}
