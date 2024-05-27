import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { Env } from "./worker";
import { describe, it, expect } from "vitest";
// Could import any other source file/function here
import worker from "./worker";

declare module "cloudflare:test" {
  // ...or if you have an existing `Env` type...
  interface ProvidedEnv extends Env {}
}

it("can websocket", async () => {
  const ctx = createExecutionContext();
  const request = new Request("http://example.com/ws", {
    headers: {
      Upgrade: "websocket",
    },
  });
  const response = await worker.fetch(request, env, ctx);

  await new Promise<void>((resolve, reject) => {
    const ws = response.webSocket!;
    ws.accept();
    ws.addEventListener("message", (message) => {
      try {
        expect(message.data).toEqual("some message");
        ws.close();
        resolve();
      } catch (e) {
        ws.close();
        reject(e);
      }
    });
  });
});

describe("party", () => {
  it.only("can be connected with a url", async () => {
    const ctx = createExecutionContext();
    const request = new Request("http://example.com/chat/123");
    const response = await worker.fetch(request, env, ctx);
    expect(await response.json()).toEqual({
      id: "123",
      party: "chat",
    });
  });

  it("can be connected with a websocket", async () => {
    const ctx = createExecutionContext();
    const request = new Request("http://example.com/chat/123", {
      headers: {
        Upgrade: "websocket",
      },
    });
    const response = await worker.fetch(request, env, ctx);

    await new Promise<void>((resolve, reject) => {
      const ws = response.webSocket!;
      ws.accept();
      ws.addEventListener("message", (message) => {
        try {
          expect(JSON.parse(message.data as string)).toEqual({
            id: "123",
            party: "chat",
          });
          ws.close();
          resolve();
        } catch (e) {
          ws.close();
          reject(e);
        }
      });
    });

    // const response = await worker.fetch(request, env, ctx);
    // expect(await response.json()).toEqual({
    //   id: "123",
    //   party: "chat",
    // });
  });
  // it("can be connected with a query parameter");
  // it("can be connected with a header");

  // describe("hibernated");
  // describe("in-memory");
});
