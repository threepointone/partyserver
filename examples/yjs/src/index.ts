import { Buffer } from "buffer";

import { WorkerEntrypoint } from "cloudflare:workers";
import { Server } from "partyflare";
import * as Y from "yjs";

import { Yjs } from "./yjs";

import type { Connection } from "partyflare";
import type { Doc } from "yjs";

export type Env = {
  Document: DurableObjectNamespace<Document>;
};

export class Document extends Yjs<Env> {
  async onLoad(doc: Y.Doc): Promise<Doc | null> {
    const content = await this.ctx.storage.get<string>("document");
    if (content) {
      Y.applyUpdate(doc, new Uint8Array(Buffer.from(content, "base64")));
    }
    return doc;
  }

  async onSave(doc: Doc, _origin: Connection): Promise<void> {
    const content = Y.encodeStateAsUpdate(doc);
    await this.ctx.storage.put(
      "document",
      Buffer.from(content).toString("base64")
    );
  }
}

export default class MyServer extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return (
      (await Server.partyFetch(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}
