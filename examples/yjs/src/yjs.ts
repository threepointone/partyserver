import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import debounce from "lodash.debounce";
import { Server } from "partyserver";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import { applyUpdate, encodeStateAsUpdate, Doc as YDoc } from "yjs";

import { handleChunked } from "./chunking";

import type { Connection, ConnectionContext } from "partyserver";

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2; // eslint-disable-line
const wsReadyStateClosed = 3; // eslint-disable-line

const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2; // eslint-disable-line

function updateHandler(update: Uint8Array, origin: unknown, doc: WSSharedDoc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  doc.conns.forEach((_, conn) => send(doc, conn, message));
}

class WSSharedDoc extends YDoc {
  conns: Map<Connection, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor() {
    super({ gc: true });

    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     */
    this.conns = new Map();

    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    const awarenessChangeHandler = (
      {
        added,
        updated,
        removed
      }: {
        added: Array<number>;
        updated: Array<number>;
        removed: Array<number>;
      },
      conn: Connection | null // Origin is the connection that made the change
    ) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs =
          /** @type {Set<number>} */ this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => {
            connControlledIDs.add(clientID);
          });
          removed.forEach((clientID) => {
            connControlledIDs.delete(clientID);
          });
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    };
    this.awareness.on("update", awarenessChangeHandler);
    // @ts-expect-error - TODO: fix this
    this.on("update", updateHandler);
  }
}

const CALLBACK_DEFAULTS = {
  debounceWait: 2000,
  debounceMaxWait: 10000,
  timeout: 5000
};

function readSyncMessage(
  decoder: decoding.Decoder,
  encoder: encoding.Encoder,
  doc: YDoc,
  transactionOrigin: Connection,
  readOnly = false
) {
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case syncProtocol.messageYjsSyncStep1:
      syncProtocol.readSyncStep1(decoder, encoder, doc);
      break;
    case syncProtocol.messageYjsSyncStep2:
      if (!readOnly)
        syncProtocol.readSyncStep2(decoder, doc, transactionOrigin);
      break;
    case syncProtocol.messageYjsUpdate:
      if (!readOnly) syncProtocol.readUpdate(decoder, doc, transactionOrigin);
      break;
    default:
      throw new Error("Unknown message type");
  }
  return messageType;
}

function closeConn(doc: WSSharedDoc, conn: Connection): void {
  if (doc.conns.has(conn)) {
    const controlledIds: Set<number> = doc.conns.get(conn) as Set<number>;
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(controlledIds),
      null
    );
  }
  try {
    conn.close();
  } catch (e) {
    console.warn("failed to close connection", e);
  }
}

function send(doc: WSSharedDoc, conn: Connection, m: Uint8Array) {
  if (
    conn.readyState !== undefined &&
    conn.readyState !== wsReadyStateConnecting &&
    conn.readyState !== wsReadyStateOpen
  ) {
    closeConn(doc, conn);
  }
  try {
    conn.send(m);
  } catch (e) {
    closeConn(doc, conn);
  }
}

interface CallbackOptions {
  debounceWait?: number;
  debounceMaxWait?: number;
  timeout?: number;
}

export class YjsDocument<Env> extends Server<Env> {
  static callbackOptions: CallbackOptions = {};

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  #ParentClass: typeof YjsDocument = Object.getPrototypeOf(this).constructor;
  #doc = new WSSharedDoc();
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async onLoad(doc: YDoc): Promise<YDoc | null> {
    // to be implemented by the user
    return null;
  }

  async onSave(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    doc: YDoc,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    origin: Connection
  ): Promise<void> {}

  async onStart(): Promise<void> {
    const src = await this.onLoad(this.#doc);
    if (src != null) {
      const state = encodeStateAsUpdate(src);
      applyUpdate(this.#doc, state);
    }

    this.#doc.on(
      "update",
      debounce(
        (update: Uint8Array, origin: Connection, doc: YDoc) => {
          try {
            this.onSave(doc, origin).catch((err) => {
              console.error("failed to persist:", err);
            });
          } catch (err) {
            console.error("failed to persist:", err);
          }
        },
        this.#ParentClass.callbackOptions.debounceWait ||
          CALLBACK_DEFAULTS.debounceWait,
        {
          maxWait:
            this.#ParentClass.callbackOptions.debounceMaxWait ||
            CALLBACK_DEFAULTS.debounceMaxWait
        }
      )
    );
  }

  onMessage = handleChunked((conn, message) => {
    if (typeof message === "string") {
      console.warn(
        `Received non-binary message. Override onMessage on ${this.#ParentClass.name} to handle string messages if required`
      );
      return;
    }
    try {
      const encoder = encoding.createEncoder();
      // TODO: this type seems odd
      const decoder = decoding.createDecoder(message as Uint8Array);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync);
          readSyncMessage(
            decoder,
            encoder,
            this.#doc,
            conn,
            // TODO: readonly conections
            false
          );

          // If the `encoder` only contains the type of reply message and no
          // message, there is no need to send the message. When `encoder` only
          // contains the type of reply, its length is 1.
          if (encoding.length(encoder) > 1) {
            send(this.#doc, conn, encoding.toUint8Array(encoder));
          }
          break;
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            this.#doc.awareness,
            decoding.readVarUint8Array(decoder),
            conn
          );
          break;
        }
      }
    } catch (err) {
      console.error(err);
      // @ts-expect-error - TODO: fix this
      this.#doc.emit("error", [err]);
    }
  });

  onClose(
    connection: Connection<unknown>,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): void | Promise<void> {
    closeConn(this.#doc, connection);
  }

  // TODO: explore why onError gets triggered when a connection closes

  onConnect(conn: Connection<unknown>, _ctx: ConnectionContext) {
    // conn.binaryType = "arraybuffer"; // from y-websocket, breaks in our runtime

    this.#doc.conns.set(conn, new Set());

    // put the following in a variables in a block so the interval handlers don't keep in in
    // scope
    {
      // send sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, this.#doc);
      send(this.#doc, conn, encoding.toUint8Array(encoder));
      const awarenessStates = this.#doc.awareness.getStates();
      if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            this.#doc.awareness,
            Array.from(awarenessStates.keys())
          )
        );
        send(this.#doc, conn, encoding.toUint8Array(encoder));
      }
    }
  }
}
