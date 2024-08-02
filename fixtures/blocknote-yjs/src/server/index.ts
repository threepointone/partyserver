import { routePartykitRequest } from "partyserver";
import { YjsDocument } from "y-partyserver";

// import * as Y from "yjs";

export type Env = {
  Document: DurableObjectNamespace<Document>;
};

export class Document extends YjsDocument<Env> {
  // async onLoad() {
  //   const content = await this.ctx.storage.get<Uint8Array>("document");
  //   if (content) {
  //     Y.applyUpdate(this.document, content);
  //   }
  //   return;
  // }
  // async onSave() {
  //   await this.ctx.storage.put<Uint8Array>(
  //     "document",
  //     Y.encodeStateAsUpdate(this.document)
  //   );
  // }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
