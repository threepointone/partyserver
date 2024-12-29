import { startTransition, useEffect, useOptimistic, useState } from "react";
import { usePartySocket } from "partysocket/react";

import type {
  BroadcastMessage,
  RpcRequest,
  RpcResponse,
  SyncRequest
} from "..";
import type { PartySocket } from "partysocket";

// we keep the actual cache external to the class
// so it can be reused across instances/rerenders

const rpcCaches = new Map<
  string,
  Map<string, ReturnType<typeof Promise.withResolvers>>
>();

class RPC<RecordType extends unknown[], Mutation> {
  private rpcCache: Map<string, ReturnType<typeof Promise.withResolvers>>;
  private controller = new AbortController();
  constructor(
    private channel: string,
    private socket: PartySocket
  ) {
    const cache = rpcCaches.get(channel);
    if (!cache) {
      rpcCaches.set(channel, new Map());
    }
    this.rpcCache = rpcCaches.get(channel)!;
    this.socket.addEventListener(
      "message",
      (event) => {
        const message = JSON.parse(event.data) as RpcResponse<RecordType>;
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

  public async call(request: Mutation, timeout = 10000): Promise<RecordType[]> {
    const id: string = crypto.randomUUID();
    this.socket.send(
      JSON.stringify({
        id,
        channel: this.channel,
        rpc: true,
        request
      } satisfies RpcRequest<Mutation>)
    );
    return this.rpc(id, timeout) as Promise<RecordType[]>;
  }

  private async resolve(response: RpcResponse<RecordType>) {
    if (response.type === "exception") {
      throw new Error(response.exception.join("\n"));
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

  destroy() {
    // this.rpcCache.clear();
    // cancel the signal
    this.controller.abort();
  }
}

export function useSync<RecordType extends unknown[], Mutation>(
  key: string,
  socket: PartySocket,
  mutate: (currentState: RecordType[], request: Mutation) => RecordType[]
): [RecordType[], (request: Mutation) => void] {
  const [data, setData] = useState<RecordType[]>([] as RecordType[]);

  const [rpc] = useState<RPC<RecordType, Mutation>>(
    () => new RPC<RecordType, Mutation>(key, socket)
  );

  useEffect(() => {
    return () => {
      rpc.destroy();
    };
  }, [rpc]);

  useEffect(() => {
    // do initial sync
    const controller = new AbortController();
    socket.send(
      JSON.stringify({
        channel: key,
        sync: true
      } satisfies SyncRequest<RecordType>)
    );
    socket.addEventListener(
      "message",
      (event) => {
        const message = JSON.parse(event.data);
        if (message.channel === key && message.sync === true) {
          // this is all the data for initial sync
          setData(message.payload);
        }
      },
      { signal: controller.signal }
    );
    return () => {
      controller.abort();
    };
  }, [socket, key]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = JSON.parse(event.data) as BroadcastMessage<RecordType>;
      if (message.broadcast === true && message.channel === key) {
        if (message.type === "update") {
          setData((records) => {
            const updates = message.payload;
            const updatedRecords = [...records];
            for (const update of updates) {
              if (update.at(-1) == null) {
                // doesn't have deleted_at, so it's not a delete
                const index = updatedRecords.findIndex(
                  (r) => r[0] === update[0]
                );
                if (index !== -1) {
                  // update the record
                  updatedRecords.splice(index, 1, update);
                } else {
                  // add the record
                  updatedRecords.push(update);
                }
              } else {
                // this is a delete
                const index = updatedRecords.findIndex(
                  (r) => r[0] === update[0]
                );
                if (index !== -1) {
                  updatedRecords.splice(index, 1);
                }
              }
            }
            return updatedRecords;
          });
        } else if (message.type === "delete-all") {
          setData([]);
        }
      }
    }

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, key]);

  const [value, setValue] = useOptimistic<RecordType[], Mutation>(
    data, // todo: this should be synced from the server
    (currentState, request) => {
      return mutate(currentState, request);
    }
  );
  return [
    value,
    (request) => {
      rpc.call(request).then((result) => {
        if (result.length === 0) {
          return;
        }
        // let changed = false;
        const newData = [...data];
        for (const record of result) {
          // if record is in data, update it

          const index = data.findIndex((item) => item[0] === record[0]);
          if (index !== -1) {
            newData.splice(index, 1, record);
            // changed = true;
          }
          // if record is not in data, add it
          else if (index === -1) {
            newData.push(record);
            // changed = true;
          }
        }
        setData(newData);
      });
      startTransition(() => {
        setValue(request);
      });
    }
  ];
}
