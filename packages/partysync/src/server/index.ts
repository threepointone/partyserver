import { Server } from "partyserver";

import type {
  BroadcastMessage,
  RpcRequest,
  RpcResponse,
  SyncRequest,
  SyncResponse
} from "../index.ts";
import type { Connection, WSMessage } from "partyserver";

export class SyncServer<
  Env,
  RecordType extends unknown[],
  Mutations extends { type: string; payload: unknown }
> extends Server<Env> {
  static options = {
    hibernate: true
  };

  handleRpcRequest(rpc: Mutations): RecordType[] | Promise<RecordType[]> {
    throw new Error("Not implemented");
  }

  // todo: store returns on a queue to flush back to client
  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    if (typeof message !== "string") {
      console.error("Received non-string message");
      return;
    }
    let json: RpcRequest<Mutations> | SyncRequest<RecordType>;

    try {
      json = JSON.parse(message);
    } catch (err) {
      connection.send(
        JSON.stringify({
          type: "exception",
          rpc: true,
          exception: [`Failed to parse message: ${(err as Error).message}`]
        } satisfies RpcResponse<RecordType>)
      );
      return;
    }

    if ("sync" in json && json.sync) {
      connection.send(
        JSON.stringify({
          sync: true,
          channel: json.channel,
          payload: [
            ...this.ctx.storage.sql
              .exec(`SELECT * FROM ${json.channel} WHERE deleted_at IS NULL`)
              .raw()
          ] as RecordType[]
        } satisfies SyncResponse<RecordType>)
      );
      return;
    }

    const { channel, id, request } = json as RpcRequest<Mutations>;

    try {
      const result = await this.handleRpcRequest(request);

      connection.send(
        JSON.stringify({
          type: "success",
          rpc: true,
          channel: channel,
          id: id,
          result: result
        } satisfies RpcResponse<RecordType>)
      );

      this.broadcast(
        JSON.stringify({
          broadcast: true,
          type: "update",
          channel: json.channel,
          payload: result
        } satisfies BroadcastMessage<RecordType>),
        [connection.id]
      );
      return;
    } catch (err) {
      connection.send(
        JSON.stringify({
          type: "error",
          rpc: true,
          channel: channel,
          id: id,
          error: [(err as Error).message]
        } satisfies RpcResponse<RecordType>)
      );
      return;
    }
  }
}
