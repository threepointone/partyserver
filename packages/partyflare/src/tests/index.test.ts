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

    await new Promise<void>((resolve, reject) => {
      const ws = response.webSocket!;
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
  // it("can be connected with a query parameter");
  // it("can be connected with a header");

  // describe("hibernated");
  // describe("in-memory");
});
