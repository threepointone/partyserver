import { WorkerEntrypoint } from "cloudflare:workers";
import { Server } from "partyflare";
import * as Y from "yjs";

import { YjsDocument } from "./yjs";

import type { Connection } from "partyflare";
import type { Doc } from "yjs";

export type Env = {
  Document: DurableObjectNamespace<Document>;
};

export class Document extends YjsDocument<Env> {
  async onLoad(doc: Y.Doc): Promise<Doc | null> {
    const content = await this.ctx.storage.get<Uint8Array>("document");
    if (content) {
      Y.applyUpdate(doc, content);
    }
    return doc;
  }

  async onSave(doc: Doc, _origin: Connection): Promise<void> {
    await this.ctx.storage.put<Uint8Array>(
      "document",
      Y.encodeStateAsUpdate(doc)
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
