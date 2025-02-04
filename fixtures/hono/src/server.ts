import { Hono } from "hono";
import { partyserverMiddleware } from "hono-party";
import { Server } from "partyserver";

import type { Connection, WSMessage } from "partyserver";

// Multiple party servers
export class Chat extends Server {
  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {
    console.log("onMessage", message);
    this.broadcast(message, [connection.id]);
  }
}

const app = new Hono();
app.use("*", partyserverMiddleware());

app.get("/", (c) => c.text("Hello from Hono!"));

export default app;
