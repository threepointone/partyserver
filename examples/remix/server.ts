import { createRequestHandler } from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";

const handleRemixRequest = createRequestHandler(build);

export default {
  async fetch(request: Request, env, ctx) {
    try {
      const loadContext = {
        env,
        ctx
      };
      return await handleRemixRequest(request, loadContext);
    } catch (error) {
      console.error("Unexpected error:", error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  }
} as ExportedHandler<Env>;
