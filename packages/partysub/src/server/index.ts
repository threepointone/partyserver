import { routePartykitRequest, Server } from "partyserver";

import type { Connection, ConnectionContext, WSMessage } from "partyserver";

type ConnectionState = {
  topics: string[];
};

export function createPubSubServer<Env = unknown>(options: {
  binding: string;
  nodes?: number;
  locations?: Record<DurableObjectLocationHint, number>;
  jurisdiction?: DurableObjectJurisdiction;
}): {
  PubSubServer: typeof Server<Env>;
  routePubSubRequest: (request: Request, env: Env) => Promise<Response | null>;
} {
  const nodes = options.nodes || 1;
  if (options.locations && options.jurisdiction) {
    throw new Error("You can't specify both locations and jurisdiction");
  }

  class PubSubServer extends Server<Env> {
    static options = {
      hibernate: true
    };

    onConnect(
      connection: Connection<ConnectionState>,
      ctx: ConnectionContext
    ): void | Promise<void> {
      const url = new URL(ctx.request.url);

      // get topics it's interested in from the url
      // save topics to state
      const initialTopics = url.searchParams.get("topics")?.split(",") || ["*"];
      connection.setState({ topics: initialTopics });
    }

    onMessage(
      connection: Connection<ConnectionState>,
      message: WSMessage
    ): void | Promise<void> {
      const { topic, data, __topics } = JSON.parse(message as string) as {
        topic: string;
        data: string;
        __topics?: string[];
      };
      // technically it'll be an object
      // with either {topic, data} or {__topics}
      // but this type makes typechecking easier

      if (__topics) {
        connection.setState({ topics: __topics });
        return;
      }

      this.broadcastPubSubMessage(topic, data);
    }

    broadcastPubSubMessage(topic: string, data: string) {
      this.publish(topic, data);
      // also publish this message to all the other nodes
      const namespace =
        // @ts-expect-error I don't know typescript
        this.env[options.binding] as DurableObjectNamespace<PubSubServer<Env>>;

      const baseName = this.name.split("-").slice(0, -1).join("-");

      for (let i = 0; i < nodes; i++) {
        const name = `${baseName}-${i}`;

        if (this.name === name) {
          continue;
        }

        const id = namespace.idFromName(name);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const stub = namespace.get(id);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        stub.publish(topic, data).catch((err: Error) => {
          console.error(`Error publishing to ${name}`);
          console.error(err);
        });
      }
    }

    publish(topic: string, data: string) {
      for (const conn of this.getConnections<ConnectionState>()) {
        // naive topic matching
        // we should look at optimising this somehow
        for (const topicToMatch of conn.state!.topics) {
          if (
            topicToMatch === "*" ||
            topicToMatch === topic ||
            (topicToMatch.endsWith(":*") &&
              topic.startsWith(topicToMatch.slice(0, -2)))
          ) {
            conn.send(JSON.stringify({ topic, data }));
          }
        }
      }
    }

    async onRequest(request: Request): Promise<Response> {
      const { topic, data } = await request.json<{
        topic: string;
        data: string;
      }>();
      if (!topic || !data) {
        return new Response("Invalid request", { status: 400 });
      }
      this.broadcastPubSubMessage(topic, data);

      return new Response("OK");
    }
  }

  async function routePubSubRequest(request: Request, env: Env) {
    // the request will come tp /parties/:party/:room
    // and we should rewrite it to /parties/:party/:room-${id}
    // where id = Math.floor(Math.random() * nodes)
    const url = new URL(request.url);
    const path = url.pathname;
    const parts = path.split("/");
    if (parts[1] !== "parties") {
      return null;
    }
    if (parts.length < 4) {
      return null;
    }
    const party = parts[2];
    const room = parts[3];

    if (party !== options.binding.toLowerCase()) {
      return null;
    }

    const id = Math.floor(Math.random() * nodes);
    const newPath = `/parties/${party}/${room}-${id}`;
    url.pathname = newPath;
    const newRequest = new Request(url.toString(), request);
    // @ts-expect-error I don't know typescript
    return routePartykitRequest(newRequest, env);
  }

  return {
    PubSubServer,
    routePubSubRequest
  };
}
