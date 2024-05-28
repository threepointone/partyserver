import { WorkerEntrypoint } from "cloudflare:workers";
import { Party } from "partyflare";

import type { Connection, WSMessage } from "partyflare";

type Env = {
  Chat: DurableObjectNamespace<Chat>;
};

export class Chat extends Party<Env> {
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
      (await Party.match(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}
