import { routePartykitRequest } from "partyserver";
import { SyncServer } from "partysync/server";

import type { TodoRecord, TodoRpc } from "../shared";
import type { RpcRequest } from "partysync";

type Env = {
  ToDos: DurableObjectNamespace<ToDos>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export class ToDos extends SyncServer<Env, TodoRecord, TodoRpc> {
  sql(sql: string, ...values: (string | number | null)[]) {
    if (
      ["insert", "update", "delete"].includes(
        sql.slice(0, sql.indexOf(" ")).toLowerCase()
      )
    ) {
      // set alarm to delete expired todos
      this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
    }
    return this.ctx.storage.sql.exec(sql, ...values);
  }
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql(`CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY NOT NULL UNIQUE, 
      text TEXT NOT NULL, 
      completed INTEGER NOT NULL, 
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, 
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at INTEGER DEFAULT NULL
    )`);
  }
  handleRpcRequest(rpc: TodoRpc): TodoRecord[] {
    switch (rpc.type) {
      case "create": {
        const { id, text, completed } = rpc.payload;
        const result = [
          ...this.sql(
            "INSERT INTO todos (id, text, completed) VALUES (?, ?, ?) RETURNING *",
            id || crypto.randomUUID(),
            text,
            completed
          ).raw()
        ];
        return result as TodoRecord[];
      }
      case "update": {
        const { id, text, completed } = rpc.payload;

        const result = [
          ...this.sql(
            "UPDATE todos SET text = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *",
            text,
            completed,
            id
          ).raw()
        ];

        return result as TodoRecord[];
      }
      case "delete": {
        const { id } = rpc.payload;
        assert(id, "id is required");
        const result = [
          ...this.sql(
            "UPDATE todos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *",
            id
          ).raw()
        ];
        return result as TodoRecord[];
      }
    }
  }
  async alarm() {
    // delete any todos that have been deleted more than 24 hours ago
    this.sql(
      "DELETE FROM todos WHERE deleted_at < ?",
      Date.now() - 24 * 60 * 60 * 1000
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
