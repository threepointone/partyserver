import { Party } from "../index";

import type { Connection, ConnectionContext } from "../index";

export type Env = {
  Stateful: DurableObjectNamespace;
};

export class Stateful extends Party<Env> {
  static options = {
    hibernate: true
  };
  // onMessage(connection: Connection, message: WSMessage) {
  //   this.broadcast(message);
  // }
  onConnect(
    connection: Connection,
    ctx: ConnectionContext
  ): void | Promise<void> {
    connection.send(
      JSON.stringify({
        id: this.id
      })
    );
  }
  onRequest(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return Response.json({
      id: this.id
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return (
      (await Party.match(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
};
