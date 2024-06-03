import { WorkerEntrypoint } from "cloudflare:workers";
import { Server } from "partyflare";

import type { Yjs } from "./yjs";

export { Yjs } from "./yjs";

export type Env = {
  Yjs: DurableObjectNamespace<Yjs>;
};

export default class MyServer extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return (
      (await Server.partyFetch(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}
