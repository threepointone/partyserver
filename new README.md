# 🎈 PartyKit

> Everything's better with friends.

PartyKit is an open-source deployment platform for AI agents, multiplayer and local-first apps, games and websites. It simplifies developing real-time collaborative applications by providing a powerful, flexible, and intuitive platform that handles the complexity of real-time infrastructure.

## 🌟 Key Features

- **Real-time Collaboration**: Build multiplayer experiences with WebSockets, Y.js, Automerge, Replicache, and more
- **Edge Computing**: Deploy your applications to a global edge network with low latency worldwide
- **AI Integration**: Run AI agents and LLMs directly in your PartyKit environment
- **Platform Agnostic**: Works alongside Vercel, Netlify, AWS, Cloudflare, and more
- **Standards Based**: Built on WebSockets, Fetch, Request-Response, and WebAssembly
- **Developer Experience**: Local development, preview environments, and comprehensive tooling

## 🚀 Quick Start

```bash
# Add to an existing Workers project
npm i partyserver
```

## 💻 Code Examples

### Basic WebSocket Server

```ts
// server.ts
import { Server, routePartykitRequest } from "partyserver";

export default class MyServer extends Server {
  // Handle WebSocket connections
  onConnect(connection) {
    console.log("Client connected!");
  }

  // Handle incoming messages
  onMessage(connection, message) {
    // Broadcast the message to all connected clients
    this.broadcast(
      message,
      // excluding the connection that sent the message
      [connection.id]
    );
  }

  // Handle HTTP requests
  onRequest(request) {
    return new Response("Hello from PartyKit!");
  }
}

// route matches requests/websockets to /parties/:party/:name to a Party server
export default routePartykitRequest;
```

And connect to it from a client:

```ts
import { PartySocket } from "partysocket";

const socket = new PartySocket({
  host: "localhost:8787",
  party: "my-party",
  name: "my-server"
});

socket.addEventListener("message", (event) => {
  console.log(event.data);
});

socket.addEventListener("close", () => {
  console.log("Connection closed");
});

// there's no need to wait for an 'open' event before seinding messages
socket.send("Hello from the client!");
```

Or from a react app:

```tsx
import { usePartySocket } from "partysocket/react";
import { useState } from "react";

function App() {
  const [message, setMessage] = useState("");
  const socket = usePartySocket({
    host: "localhost:8787",
    party: "my-party",
    name: "my-server"
  });

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={() => socket.send(message)}>Send</button>
    </div>
  );
}
```

### Real-time Chat Application

```ts
// chat-server.ts
import { Server } from "partyserver";

export default class ChatServer extends Server {
  constructor() {
    this.messages = [];
  }

  onConnect(connection, { request }) {
    // Send chat history to new users
    connection.send(
      JSON.stringify({ type: "history", messages: this.messages })
    );
    connection.setState({ user: "Anonymous" }); // you could also set state from the request headers
  }

  onMessage(connection, message) {
    const data = JSON.parse(message);

    if (data.type === "message") {
      const chatMessage = {
        id: Date.now(),
        text: data.text,
        user: data.user,
        timestamp: new Date().toISOString()
      };

      this.messages.push(chatMessage);
      this.broadcast(JSON.stringify({ type: "message", message: chatMessage }));
    }
  }
}
```

### Every Server has its own SQLite database

```ts
import { Server } from "partyserver";

export default class MyServer extends Server {
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS messages (user TEXT, message TEXT)`;
  }

  onConnect(connection) {
    connection.setState({ user: "Anonymous" });
  }

  onMessage(connection, message) {
    this
      .sql`INSERT INTO messages (user, message) VALUES (${connection.getState().user}, ${message.message})`;
  }
}
```

### Collaborative Text Editor with Y.js

```ts
// editor-server.js
import { YServer } from "y-partyserver";

export default class EditorServer extends YServer {
  async onLoad() {
    // load a document from a database, or some remote resource
    // and apply it on to the Yjs document instance at `this.document`
    const content = (await fetchDataFromExternalService(
      this.name
    )) as Uint8Array;
    if (content) {
      Y.applyUpdate(this.document, content);
    }
    return;
  }

  async onSave() {
    // called every few seconds after edits, and when the room empties
    // you can use this to write to a database or some external storage

    await sendDataToExternalService(
      this.name,
      Y.encodeStateAsUpdate(this.document) satisfies Uint8Array
    );
  }
}
```

### AI Chat Room

```ts
// ai-chat-server.js
export default class AIChatServer {
  async onMessage(message, ws) {
    const data = JSON.parse(message);

    if (data.type === "chat") {
      // Process message with AI
      const response = await this.processWithAI(data.message);

      // Send response back to the client
      ws.send(
        JSON.stringify({
          type: "ai-response",
          message: response
        })
      );
    }
  }

  async processWithAI(message) {
    // Integrate with your preferred AI model
    // Example using OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: message }]
      })
    });

    return await response.json();
  }
}
```

## 🔧 API Reference

### Lifecycle Hooks

PartyKit provides several lifecycle hooks that you can implement in your server class:

```ts
export default class MyServer extends Server {
  // Called when the server starts or wakes up from hibernation
  async onStart() {
    // Initialize your server
    await this.loadData();
  }

  // Called when a new WebSocket connection is established
  onConnect(ws, context) {
    // Set up connection-specific state
    ws.setState({ user: "Anonymous" });
  }

  // Called when a message is received
  onMessage(ws, message) {
    // Handle incoming messages
  }

  // Called when a connection is closed
  onClose(ws, code, reason, wasClean) {
    // Clean up connection-specific state
  }

  // Called when an error occurs on a connection
  onError(ws, error) {
    // Handle connection errors
  }

  // Called when an HTTP request is made to the server
  onRequest(request) {
    return new Response("Hello from PartyKit!");
  }

  // Called when an alarm is triggered
  async onAlarm() {
    // Handle scheduled tasks
  }
}
```

### Hibernation Support

```ts
export default class MyServer {
  static options = {
    hibernate: true // Enable hibernation
  };

  async onStart() {
    // This will be called when the server starts or wakes up
    await this.loadData();
  }
}
```

Learn more about Durable Object hibernation [here](https://developers.cloudflare.com/durable-objects/best-practices/websockets/#websocket-hibernation-api).

## 📦 Core Packages

- **[PartyServer](/packages/partyserver/README.md)** - The core library for building real-time applications
- **[PartySocket](/packages/partysocket/README.md)** - WebSocket client with reconnection, buffering, and resilience
- **[Y-PartyServer](/packages/y-partyserver/README.md)** - Yjs integration for real-time collaborative editing
- **[🥖 partysub](/packages/partysub/README.md)** - Scalable pub/sub system for distributed applications
- **[partysync](/packages/partysync/README.md)** - State synchronization between Durable Objects and clients
- **[⏱️ partywhen](/packages/partywhen/README.md)** - Distributed task scheduling system
- **[hono-party](/packages/hono-party/README.md)** - Hono middleware for PartyServer integration

## 🎯 Use Cases

### Collaborative Apps

- **Whiteboards**: Real-time drawing and collaboration
- **Code Editors**: Multiplayer coding environments
- **Text Editors**: Collaborative document editing
- **Music Co-creation**: Synchronized music production

### Multiplayer Games

- Real-time game state synchronization
- Player presence and matchmaking
- In-game chat and social features
- Leaderboards and achievements

### AI Agents

- Long-running AI bots and assistants
- Real-time AI-powered chat rooms
- Collaborative AI workspaces
- AI-powered game NPCs

### Live Experiences

- Interactive events and conferences
- Virtual workshops and classrooms
- Live polls and surveys
- Watch parties and synchronized media

### Real-time Analytics

- Live dashboards and monitoring
- User activity tracking
- Performance metrics
- Real-time data visualization

### Social Features

- User presence and status
- Real-time chat and messaging
- Collaborative features
- Social interactions and reactions

## 💡 Examples

Check out our [examples directory](/fixtures/) for sample applications and tutorials:

- Active user avatars
- Chat applications with AI agents
- Collaborative text editors
- Live polls and surveys
- Multiplayer games
- Real-time reaction counters
- Watch parties and synchronized media

## 🤝 Community

- [Discord](https://discord.gg/partykit) - Join our community
- [Twitter](https://twitter.com/partykit_io) - Follow for updates
- [GitHub](https://github.com/cloudflare/partykit) - Star and contribute

## 📚 Documentation

Visit [docs.partykit.io](https://docs.partykit.io) for comprehensive documentation, tutorials, and API references.

## 🎓 Learning Resources

- [Quickstart Guide](https://docs.partykit.io/quickstart)
- [API Reference](https://docs.partykit.io/api)
- [Tutorials](https://docs.partykit.io/tutorials)
- [Examples](https://docs.partykit.io/examples)

## 📄 License

PartyKit is open source software [licensed under the MIT license](/LICENSE).
