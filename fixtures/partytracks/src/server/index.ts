// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Env = {};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return new Response("Hello World");
  }
} satisfies ExportedHandler<Env>;
