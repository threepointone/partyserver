import { Party } from "../index";

import type { Connection, ConnectionContext } from "../index";

export type Env = {
  Stateful: DurableObjectNamespace;
};

export class Stateful extends Party<Env> {
  static options = {
    hibernate: true
  };

  onConnect(
    connection: Connection,
    _ctx: ConnectionContext
  ): void | Promise<void> {
    connection.send(
      JSON.stringify({
        room: this.room
      })
    );
  }

  onRequest(
    _request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return Response.json({
      room: this.room
    });
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    return (
      (await Party.match(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
};
