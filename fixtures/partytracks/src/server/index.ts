import { Hono } from "hono";
import { routePartyTracksRequest } from "partytracks/server";

type Bindings = {
  CALLS_APP_ID: string;
  CALLS_APP_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("/partytracks/*", (c) =>
  routePartyTracksRequest({
    appId: c.env.CALLS_APP_ID,
    token: c.env.CALLS_APP_TOKEN,
    request: c.req.raw
  })
);

export default app;
