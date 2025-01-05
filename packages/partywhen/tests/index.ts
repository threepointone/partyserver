import type { Env } from "./env";

export { Scheduler } from "../src/index";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const id = env.SCHEDULER.idFromName("example");
    const stub = env.SCHEDULER.get(id);
    return stub.fetch(request);
  }
} satisfies ExportedHandler<Env>;
