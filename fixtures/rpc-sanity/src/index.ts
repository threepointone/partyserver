import { getServerByName, Server } from "partyserver";

type Env = {
  MyServer: DurableObjectNamespace<MyServer>;
};

export class MyServer extends Server<Env> {
  // eslint-disable-next-line @typescript-eslint/require-await
  async testMethod() {
    return this.name;
  }
  onRequest(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/test") {
      throw new Error("test onRequest");
    }
    return new Response("test onRequest");
  }
}

const SESSION_ID = "session-id";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    const stub = await getServerByName(env.MyServer, SESSION_ID);

    if (url.pathname === "/rpc") {
      const value = await stub.testMethod();
      return new Response(`the value is ${value}`);
    }
    return stub.fetch(request);
  }
} satisfies ExportedHandler<Env>;
