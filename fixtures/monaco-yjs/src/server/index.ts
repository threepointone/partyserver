import { routePartykitRequest } from "partyserver";
import { YjsDocument } from "y-partyserver";

type Env = {
  MonacoServer: DurableObjectNamespace<YjsDocument>;
};

export { YjsDocument as MonacoServer };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
