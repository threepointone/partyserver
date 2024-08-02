import { WorkerEntrypoint } from "cloudflare:workers";
import { routePartykitRequest, Server } from "partyserver";

import type { Connection, WSMessage } from "partyserver";

type Env = {
  Chat: DurableObjectNamespace<Chat>;
};

export class Chat extends Server {
  static options = {
    hibernate: true
  };

  onMessage(connection: Connection, message: WSMessage) {
    this.broadcast(message);
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
