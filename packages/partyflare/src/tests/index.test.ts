import {
  createExecutionContext,
  env
  // waitOnExecutionContext
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Could import any other source file/function here
import worker from "./worker";

import type { Env } from "./worker";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

describe("party", () => {
  it("can be connected with a url", async () => {
    const ctx = createExecutionContext();
    const request = new Request("http://example.com/parties/stateful/123");
    const response = await worker.fetch(request, env, ctx);
    expect(await response.json()).toEqual({
      room: "123"
    });
  });

  it("can be connected with a websocket", async () => {
    const ctx = createExecutionContext();
    const request = new Request("http://example.com/parties/stateful/123", {
      headers: {
        Upgrade: "websocket"
      }
    });
    const response = await worker.fetch(request, env, ctx);
    const ws = response.webSocket!;

    await new Promise<void>((resolve, reject) => {
      ws.accept();
      ws.addEventListener("message", (message) => {
        try {
          expect(JSON.parse(message.data as string)).toEqual({
            room: "123"
          });
          ws.close();
          resolve();
        } catch (e) {
          ws.close();
          reject(e);
        }
      });
    });
  });

  it("calls onStart only once, and does not process messages or requests until it is resolved", async () => {
    const ctx = createExecutionContext();

    function makeConnection() {
      return new Promise<void>((resolve, reject) => {
        const request = new Request(
          "http://example.com/parties/onstartparty/123",
          {
            headers: {
              Upgrade: "websocket"
            }
          }
        );
        worker
          .fetch(request, env, ctx)
          .then<void>((response) => {
            const ws = response.webSocket!;
            ws.accept();
            ws.addEventListener("message", (message) => {
              try {
                expect(message.data).toEqual("1");
                ws.close();
                resolve();
              } catch (e) {
                ws.close();
                reject(e);
              }
            });
          })
          .catch((e) => {
            reject(e);
          });
      });
    }

    await Promise.all([makeConnection(), makeConnection()]);
  });
  // it("can be connected with a query parameter");
  // it("can be connected with a header");

  // describe("hibernated");
  // describe("in-memory");
});
