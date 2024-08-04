import { createPubSubServer } from "partysub/server";

type Env = {
  PubSub: typeof PubSubServer;
};

const { PubSubServer, routePubSubRequest } = createPubSubServer({
  binding: "PubSub",
  nodes: 100
});

export { PubSubServer };

export default {
  async fetch(req, env) {
    const pubsubResponse = await routePubSubRequest(req, env);
    return pubsubResponse || new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
