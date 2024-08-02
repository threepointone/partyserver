import { routePartykitRequest } from "partyserver";
import { YjsDocument } from "y-partyserver";

// import * as Y from "yjs";

type Env = {
  Document: DurableObjectNamespace<YjsDocument>;
};

export { YjsDocument as LexicalDocument };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
