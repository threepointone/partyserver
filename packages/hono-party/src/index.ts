import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { routePartykitRequest } from "partyserver";

import type { Context, Env } from "hono";
import type { PartykitOptions } from "partyserver";

/**
 * Configuration options for the PartyKit middleware
 */
type PartyKitMiddlewareContext<E extends Env> = {
  /** PartyKit-specific configuration options */
  options?: PartykitOptions<E>;
  /** Optional error handler for caught errors */
  onError?: (error: Error) => void;
};

/**
 * Creates a middleware for handling PartyKit WebSocket and HTTP requests
 * Processes both WebSocket upgrades and standard HTTP requests, delegating them to PartyKit
 */
export function partyKitMiddleware<E extends Env = Env>(
  ctx?: PartyKitMiddlewareContext<E>
) {
  return createMiddleware(async (c, next) => {
    try {
      const handler = isWebSocketUpgrade(c)
        ? handleWebSocketUpgrade
        : handleHttpRequest;
      const response = await handler(c, ctx?.options);

      return response === null ? await next() : response;
    } catch (error) {
      if (ctx?.onError) {
        ctx.onError(error as Error);
        return next();
      }
      throw error;
    }
  });
}

/**
 * Checks if the incoming request is a WebSocket upgrade request
 * Looks for the 'upgrade' header with a value of 'websocket' (case-insensitive)
 */
function isWebSocketUpgrade(c: Context): boolean {
  return c.req.header("upgrade")?.toLowerCase() === "websocket";
}

/**
 * Creates a new Request object from the Hono context
 * Preserves the original request's URL, method, headers, and body
 */
function createRequestFromContext(c: Context) {
  return new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header(),
    body: c.req.raw.body
  });
}

/**
 * Handles WebSocket upgrade requests
 * Returns a WebSocket upgrade response if successful, null otherwise
 */
async function handleWebSocketUpgrade<E extends Env>(
  c: Context<E>,
  options?: PartykitOptions<E>
) {
  const req = createRequestFromContext(c);
  const response = await routePartykitRequest(req, env(c), options);

  if (!response?.webSocket) {
    return null;
  }

  return new Response(null, {
    status: 101,
    webSocket: response.webSocket
  });
}

/**
 * Handles standard HTTP requests
 * Forwards the request to PartyKit and returns the response
 */
async function handleHttpRequest<E extends Env>(
  c: Context<E>,
  options?: PartykitOptions<E>
) {
  const req = createRequestFromContext(c);
  return routePartykitRequest(req, env(c), options);
}
