import { Server } from "partyserver";

import type {
  BroadcastMessage,
  RpcAction,
  RpcException,
  RpcResponse,
  SyncRequest,
  SyncResponse
} from "../index.ts";
import type { Connection, WSMessage } from "partyserver";

export class SyncServer<
  Env,
  Channels extends {
    [Channel: string]: [unknown[], { type: string; payload: unknown }];
  }
> extends Server<Env> {
  static options = {
    hibernate: true
  };

  onAction<Channel extends keyof Channels>(
    channel: Channel,
    action: Channels[Channel][1]
  ): Channels[Channel][0][] | Promise<Channels[Channel][0][]> {
    throw new Error(
      "onAction not implemented, you should implement this in your server"
    );
  }

  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    if (typeof message !== "string") {
      console.error("Received non-string message");
      return;
    }

    let json:
      | RpcAction<Channels[keyof Channels][1]>
      | SyncRequest<Channels[keyof Channels][0]>;
    try {
      json = JSON.parse(message);
    } catch (err) {
      connection.send(
        JSON.stringify({
          type: "exception",
          rpc: true,
          exception: [`Failed to parse message: ${(err as Error).message}`]
        } satisfies RpcException)
      );
      return;
    }

    const channel = json.channel as keyof Channels;

    if ("sync" in json && json.sync) {
      console.log("syncing from", json.from);
      connection.send(
        JSON.stringify({
          sync: true,
          channel: channel as string,
          payload: [
            ...(json.from
              ? this.ctx.storage.sql
                  .exec(
                    `SELECT * FROM ${channel as string} WHERE deleted_at IS NULL AND updated_at > ?`,
                    json.from
                  )
                  .raw()
              : this.ctx.storage.sql
                  .exec(
                    `SELECT * FROM ${channel as string} WHERE deleted_at IS NULL`
                  )
                  .raw())
          ] as Channels[typeof channel][0][]
        } satisfies SyncResponse<Channels[typeof channel][0]>)
      );
      return;
    }

    const { id, action } = json as RpcAction<Channels[typeof channel][1]>;

    try {
      const result = await this.onAction(channel, action);

      connection.send(
        JSON.stringify({
          type: "success",
          rpc: true,
          channel: channel as string,
          id: id,
          result: result
        } satisfies RpcResponse<Channels[typeof channel][0]>)
      );

      this.broadcast(
        JSON.stringify({
          broadcast: true,
          type: "update",
          channel: channel as string,
          payload: result
        } satisfies BroadcastMessage<Channels[typeof channel][0]>),
        [connection.id]
      );
    } catch (err) {
      connection.send(
        JSON.stringify({
          type: "error",
          rpc: true,
          channel: channel as string,
          id: id,
          error: [(err as Error).message]
        } satisfies RpcResponse<Channels[typeof channel][0]>)
      );
    }
  }
}
