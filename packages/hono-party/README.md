# hono-party

A middleware for [Hono](https://hono.dev) to handle [PartyServer](https://github.com/threepointone/partyserver) requests. Useful for exposing many PartyServer servers within a single Hono app.

```bash
npm install hono-party hono partyserver
```

## Usage

```typescript
import { Hono } from "hono";
import { partyserverMiddleware } from "hono-party";
import { Server } from "partyserver";

// Multiple party servers
export class Chat extends Server {}
export class Game extends Server {}
export class Document extends Server {}

// Basic setup
const app = new Hono();
app.use("*", partyserverMiddleware());

// or with authentication
app.use(
  "*",
  partyserverMiddleware({
    options: {
      onBeforeConnect: async (req) => {
        const token = req.headers.get("authorization");
        // validate token
        if (!token) return new Response("Unauthorized", { status: 401 });
      }
    }
  })
);

// With error handling
app.use(
  "*",
  partyserverMiddleware({
    onError: (error) => console.error(error)
  })
);

// With custom routing
app.use(
  "*",
  partyserverMiddleware({
    options: {
      prefix: "/party" // Handles /party/* routes only
    }
  })
);

export default app;
```

## React Usage

```typescript
import { usePartySocket } from "partysocket/react";

const honoUrl = "http://localhost:3000";

// Basic connection
const socket = usePartySocket({
  party: "chat",
  room: "general"
});

// game connection
const socket = usePartySocket({
  party: "game",
  room: "uuid"
});

// document connection
const socket = usePartySocket({
  party: "document",
  room: "id"
});

// With auth
const socket = usePartySocket({
  party: "chat",
  room: "general",
  headers: {
    authorization: `Bearer ${token}`
  }
});
```

## Configuration

```toml
# wrangler.toml
[durable_objects]
bindings = [
  { name = "Chat", class_name = "Chat" },
  { name = "Game", class_name = "Game" },
  { name = "Document", class_name = "Document" }
]

[[migrations]]
tag = "v1"
new_classes = ["Chat", "Game", "Document"]
```
