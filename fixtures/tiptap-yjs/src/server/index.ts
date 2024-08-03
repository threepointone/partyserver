import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";

type Env = {
  Document: DurableObjectNamespace<YServer>;
};

export { YServer as Document };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
