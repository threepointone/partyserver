// we keep the actual cache external to the class
// so it can be reused across instances/rerenders
import { nanoid } from "nanoid";

import type { WebSocket as PSWebSocket } from "partysocket";

export type RpcAction<T> = {
  id: string;
  channel: string;
  rpc: true;
  action: T;
};

export type RpcResponse<ResponseType> =
  | {
      id: string;
      channel: string;
      rpc: true;
      type: "success";
      result: ResponseType;
    }
  | {
      id: string;
      channel: string;
      rpc: true;
      type: "error";
      error: string[];
    };

export type RpcException = {
  rpc: true;
  type: "exception";
  exception: string[];
};

// hmm this might not actually need to be a global cache
const rpcCaches = new Map<
  string,
  Map<string, ReturnType<typeof Promise.withResolvers>>
>();

export class RPCClient<RequestType, ResponseType> {
  private rpcCache: Map<string, ReturnType<typeof Promise.withResolvers>>;
  private controller = new AbortController();
  constructor(
    private channel: string,
    private socket: PSWebSocket
  ) {
    const cache = rpcCaches.get(channel);
    if (!cache) {
      rpcCaches.set(channel, new Map());
    }
    this.rpcCache = rpcCaches.get(channel)!;
    this.socket.addEventListener(
      "message",
      (event) => {
        const message = JSON.parse(
          (event as MessageEvent).data as string
        ) as RpcResponse<ResponseType>;
        if (
          (message.type === "success" || message.type === "error") &&
          message.channel === this.channel &&
          message.rpc === true
        ) {
          this.resolve(message);
        }
      },
      { signal: this.controller.signal }
    );
  }

  private rpc(id: string, timeout = 10000) {
    const resolver = Promise.withResolvers();
    this.rpcCache.set(id, resolver);
    setTimeout(() => {
      this.rpcCache.delete(id);
      resolver.reject(new Error(`RPC call ${id} timed out`));
    }, timeout);
    return resolver.promise;
  }

  public async call(
    action: RequestType,
    timeout = 10000
  ): Promise<ResponseType> {
    const id: string = nanoid(8);
    this.socket.send(
      JSON.stringify({
        id,
        channel: this.channel,
        rpc: true,
        action
      } satisfies RpcAction<RequestType>)
    );
    return this.rpc(id, timeout) as Promise<ResponseType>;
  }

  private async resolve(response: RpcResponse<ResponseType> | RpcException) {
    if (response.type === "exception") {
      this.onException(response.exception);
      return;
    }
    const resolver = this.rpcCache.get(response.id);
    if (!resolver) {
      console.warn(`No resolver found for id: ${response.id}`);
      return;
    }
    if (response.type === "success") {
      resolver.resolve(response.result);
    } else {
      resolver.reject(new Error(response.error.join("\n")));
    }
  }

  onException(exception: string[]) {
    console.warn("Override this method to handle exceptions");
    console.error(exception);
  }

  destroy() {
    // this.rpcCache.clear();
    // cancel the signal
    this.controller.abort();
  }
}
