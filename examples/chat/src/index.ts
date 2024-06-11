import { WorkerEntrypoint } from "cloudflare:workers";
import { Server } from "partyserver";

import type { Connection, WSMessage } from "partyserver";

type Env = {
  Chat: DurableObjectNamespace<Chat>;
};

export class Chat extends Server<Env> {
  static options = {
    hibernate: true
  };

  onMessage(connection: Connection, message: WSMessage) {
    this.broadcast(message);
  }
}

export default class MyServer extends WorkerEnrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return (
      (await Server.partyFetch(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}
