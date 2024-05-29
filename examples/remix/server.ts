import { createRequestHandler, logDevReady } from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";

// @ts-expect-error process isn't a global yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
if (process.env.NODE_ENV === "development") {
  logDevReady(build);
}

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
