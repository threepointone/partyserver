import { WorkerEntrypoint } from "cloudflare:workers";
import { routePartykitRequest } from "partyserver";
import { YjsDocument } from "y-partyserver";
import * as Y from "yjs";

export type Env = {
  Document: DurableObjectNamespace<Document>;
};

export class Document extends YjsDocument<Env> {
  async onLoad() {
    const content = await this.ctx.storage.get<Uint8Array>("document");
    if (content) {
      Y.applyUpdate(this.document, content);
    }
    return;
  }

  async onSave() {
    await this.ctx.storage.put<Uint8Array>(
      "document",
      Y.encodeStateAsUpdate(this.document)
    );
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
