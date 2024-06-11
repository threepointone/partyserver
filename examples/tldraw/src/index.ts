import { WorkerEntrypoint } from "cloudflare:workers";
import { routePartykitRequest, Server } from "partyserver";
import { createTLSchema, throttle } from "tldraw";

import type { Connection } from "partyserver";
import type { HistoryEntry, TLRecord, TLStoreSnapshot } from "tldraw";

type Env = {
  Tldraw: DurableObjectNamespace<Tldraw>;
};

export class Tldraw extends Server<Env> {
  records: Record<string, TLRecord> = {};
  readonly schema = createTLSchema();

  async onStart(): Promise<void> {
    // need to make sure we've loaded the snapshot before we can let clients connect
    const snapshot = await this.ctx.storage.get<TLStoreSnapshot>("snapshot");
    if (!snapshot) return;

    const migrationResult = this.schema.migrateStoreSnapshot(snapshot);
    if (migrationResult.type === "error") {
      throw new Error(migrationResult.reason);
    }

    this.records = migrationResult.value;
  }

  persist = throttle(async () => {
    await this.ctx.storage.put("snapshot", {
      store: this.records,
      schema: this.schema.serialize()
    });
  }, 1000);

  onConnect(connection: Connection<unknown>) {
    connection.send(
      JSON.stringify({
        type: "init",
        snapshot: { store: this.records, schema: this.schema.serialize() }
      })
    );
  }

  async onMessage(sender: Connection<unknown>, message: string): Promise<void> {
    const msg = JSON.parse(message) as
      | {
          type: "update";
          updates: HistoryEntry<TLRecord>[];
        }
      | {
          type: "recovery";
        };
    const schema = createTLSchema().serialize();
    switch (msg.type) {
      case "update": {
        try {
          for (const update of msg.updates) {
            const {
              changes: { added, updated, removed }
            } = update;
            // Try to merge the update into our local store
            for (const record of Object.values(added)) {
              this.records[record.id] = record;
            }
            for (const [, to] of Object.values(updated)) {
              this.records[to.id] = to;
            }
            for (const record of Object.values(removed)) {
              delete this.records[record.id];
            }
          }
          // If it works, broadcast the update to all other clients
          this.broadcast(message, [sender.id]);
          // and update the storage layer
          await this.persist();
        } catch (err) {
          // If we have a problem merging the update, we need to send a snapshot
          // of the current state to the client so they can get back in sync.
          sender.send(
            JSON.stringify({
              type: "recovery",
              snapshot: { store: this.records, schema }
            })
          );
        }
        break;
      }
      case "recovery": {
        const schema = createTLSchema().serialize();
        // If the client asks for a recovery, send them a snapshot of the current state
        sender.send(
          JSON.stringify({
            type: "recovery",
            snapshot: { store: this.records, schema }
          })
        );
        break;
      }
    }
  }
}

export default class MyServer extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return (
      (await routePartykitRequest(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}
