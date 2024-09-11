import { getServerByName, Server } from "partyserver";

type Env = {
  MyServer: DurableObjectNamespace<MyServer>;
};

export class MyServer extends Server<Env> {
  // eslint-disable-next-line @typescript-eslint/require-await
  async testMethod() {
    return this.name;
  }
}

const SESSION_ID = "session-id";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const stub = await getServerByName(env.MyServer, SESSION_ID);
    const value = await stub.testMethod();
    return new Response(`the value is ${value}`);
  }
} satisfies ExportedHandler<Env>;
