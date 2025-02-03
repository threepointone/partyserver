# hono-party

A middleware for [Hono](https://hono.dev) to handle [PartyKit](https://partykit.io) requests. Useful for exposing many PartyKit servers within a single Hono app.

```bash
npm install hono-party
```

## Usage

```typescript
import { Hono } from "hono";
import { partyKitMiddleware } from "hono-party";
import { Server } from "partyserver";

// Multiple party servers
class Chat extends Server {}
class Game extends Server {}
class Document extends Server {}

// Basic setup
const app = new Hono();
app.use("*", partyKitMiddleware({}));

// or with authentication
app.use(
  "*",
  partyKitMiddleware({
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
  partyKitMiddleware({
    onError: (error) => console.error(error)
  })
);

// With custom routing
app.use(
  "*",
  partyKitMiddleware({
    options: {
      prefix: "/party" // Handles /party/* routes only
    }
  })
);

export default app;
export { Chat, Game, Document };
```

## React Usage

```typescript
import { usePartySocket } from "partysocket/react";

const honoUrl = "http://localhost:3000";

// Basic connection
const socket = usePartySocket({
  host: honoUrl,
  party: "chat",
  room: "general"
});

// game connection
const socket = usePartySocket({
  host: honoUrl,
  party: "game",
  room: "uuid"
});

// document connection
const socket = usePartySocket({
  host: honoUrl,
  party: "document",
  room: "id"
});

// With auth
const socket = usePartySocket({
  host: honoUrl,
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
