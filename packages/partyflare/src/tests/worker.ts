import { Party } from "../index";

import type { Connection, ConnectionContext } from "../index";

export type Env = {
  Stateful: DurableObjectNamespace<Stateful>;
  OnStartParty: DurableObjectNamespace<OnStartParty>;
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

export class OnStartParty extends Party<Env> {
  counter = 0;
  async onStart() {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.counter++;
        resolve();
      }, 300);
    });
  }
  onConnect(connection: Connection) {
    connection.send(this.counter.toString());
  }
  onRequest(
    _request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return new Response(this.counter.toString());
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
