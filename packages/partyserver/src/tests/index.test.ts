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

describe("Server", () => {
  it("can be connected with a url", async () => {
    const ctx = createExecutionContext();
    const request = new Request("http://example.com/parties/stateful/123");
    const response = await worker.fetch(request, env, ctx);
    expect(await response.json()).toEqual({
      name: "123"
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

    const { promise, resolve, reject } = Promise.withResolvers<void>();
    ws.accept();
    ws.addEventListener("message", (message) => {
      try {
        expect(JSON.parse(message.data as string)).toEqual({
          name: "123"
        });
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        ws.close();
      }
    });

    return promise;
  });

  it("calls onStart only once, and does not process messages or requests until it is resolved", async () => {
    const ctx = createExecutionContext();

    async function makeConnection() {
      const request = new Request(
        "http://example.com/parties/on-start-server/123",
        {
          headers: {
            Upgrade: "websocket"
          }
        }
      );
      const response = await worker.fetch(request, env, ctx);
      const ws = response.webSocket!;
      ws.accept();
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      ws.addEventListener("message", (message) => {
        try {
          expect(message.data).toEqual("1");
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          ws.close();
        }
      });
      return promise;
    }

    async function makeRequest() {
      const request = new Request(
        "http://example.com/parties/on-start-server/123"
      );
      const response = await worker.fetch(request, env, ctx);
      expect(await response.text()).toEqual("1");
    }

    await Promise.all([makeConnection(), makeConnection(), makeRequest()]);
  });

  it(".name is available inside onStart", async () => {
    const ctx = createExecutionContext();
    const request = new Request(
      "http://example.com/parties/on-start-server/999"
    );
    const response = await worker.fetch(request, env, ctx);
    expect(response.status).toBe(200);
  });
  // it("can be connected with a query parameter");
  // it("can be connected with a header");

  // describe("hibernated");
  // describe("in-memory");
});
