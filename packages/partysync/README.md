## partysync

An experimental library to synchronise state from a Durable Object to a client.

> [!WARNING]
> WIP, API and design is subject to change.

See the [Todo fixture](/fixtures/todo-sync/) for a fully working example.

## Usage

First, Setup your server.

```ts
// server.ts
import { SyncServer } from "partysync";

// define your actions
type Action =
  | {
      type: "create";
      payload: {
        id: string;
        text: string;
        completed: 0 | 1; // to match sqlite's idea of a boolean
      };
    }
  | {
      type: "update";
      // ... etc
    };

// define the shape of the records that are stored in the Durable Object database
type RecordType = [
  // NOTE: _always_ add id
  string, // id
  string, // text
  0 | 1, // completed
  number, // created_at
  number, // updated_at
  // NOTE: _always_ add deleted_at
  number | null // deleted_at
];

// NOTE: we do soft deletes so we can sync deleted records to the client

export class MyServer extends SyncServer<Env, Action, RecordType> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    // setup a database table for your records
    this.sql(`CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY NOT NULL UNIQUE, 
      text TEXT NOT NULL, 
      completed INTEGER NOT NULL, 
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, 
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at INTEGER DEFAULT NULL
    )`);
  }
  // setup a handler for actions
  onAction(action) {
    switch (action.type) {
      case "create": {
        const { id, text, completed } = action.payload;
        return this.ctx.storage.sql.exec(
          "INSERT INTO todos (id, text, completed) VALUES (?, ?, ?) RETURNING *",
          id,
          text,
          completed
        );
      }
      // etc
    }
  }
}
```

Then, setup your client.

```tsx
// client.tsx
import { useSync } from "partysync/react";

// in your component...
const [todos, sendAction] = useSync<RecordType, Action>(
  "todos",
  socket, // your websocket
  // optionally do an optimistic update
  (todos, action) => {
    switch (action.type) {
      case "create": {
        const { id, text, completed } = action.payload;
        return [...todos, [id, text, completed, Date.now(), Date.now(), null]];
      }
      // ... etc
    }
  }
);

// call the action whenever
function onClick() {
  sendAction({
    type: "create",
    payload: { id: "1", text: "hello", completed: 0 }
  });
}
```
