import { Hono } from "hono";
import { makeCallsProxyHandler } from "partytracks/server";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Bindings = {
  CALLS_APP_ID: string;
  CALLS_APP_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("/api/calls/*", (c) =>
  makeCallsProxyHandler({
    appId: c.env.CALLS_APP_ID,
    token: c.env.CALLS_APP_TOKEN,
    proxyPath: "/api/calls"
  })(c.req.raw)
);

export default app;
