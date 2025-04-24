import invariant from "tiny-invariant";
import { parse } from "cookie";
import * as jose from "jose";

const unauthorizedResponse = () =>
  new Response("unauthorized", {
    status: 401
  });

interface Config {
  /**
   * Cloudflare Calls App ID. Can be created here https://dash.cloudflare.com/?to=/:account/calls/create-sfu-application
   */
  appId: string;
  /**
   * Cloudflare Calls App Token. Can be created here https://dash.cloudflare.com/?to=/:account/calls/create-sfu-application
   */
  token: string;
  /**
   * The part of the pathname in the original request URL that should be replaced.
   * For example, if your proxy path is /api/partytracks/*, the value should be "/api/partytracks"
   */
  prefix?: string;
  /**
   * The base URL for the Cloudflare Calls API
   */
  callsApiBaseUrl?: string;
  /**
   * The original request
   */
  request: Request;
  /**
   * Creates a JWT cookie for the initial request that created the session and
   * prevents anyone who doesn't have a valid JWT from manipulating the session.
   * On by default. Disabl
   */
  lockSessionToInitiator?: boolean;
}

export const routePartyTracksRequest = async ({
  appId,
  token,
  callsApiBaseUrl = `https://rtc.live.cloudflare.com/v1/apps/${appId}`,
  prefix = "/partytracks",
  request,
  lockSessionToInitiator = process.env.NODE_ENV === "production"
}: Config) => {
  const { headers, body, url, method } = request;
  const previousUrl = new URL(url);

  if (!previousUrl.pathname.startsWith(prefix)) {
    return new Response(null, { status: 404 });
  }

  // Forward headers while adding auth
  const newHeaders = new Headers(headers);
  newHeaders.set("Authorization", `Bearer ${token}`);
  const callsInit: RequestInit = {
    headers: newHeaders,
    method
  };

  const contentLength = headers.get("Content-Length");
  if (contentLength !== null) {
    const parsedContentLength = Number(contentLength);
    invariant(
      !Number.isNaN(parsedContentLength),
      "Content-Length header is not a number"
    );
    if (parsedContentLength > 0 || headers.has("Transfer-Encoding")) {
      callsInit.body = body;
    }
  }

  const callsUrl = new URL(callsApiBaseUrl);
  callsUrl.pathname = previousUrl.pathname.replace(prefix, callsUrl.pathname);
  callsUrl.search = previousUrl.search;

  if (!lockSessionToInitiator) {
    return fetch(callsUrl, callsInit);
  }

  const isCreatingNewSession =
    previousUrl.pathname === `${prefix}/sessions/new`;

  if (isCreatingNewSession) {
    const createdSessionResponse = await fetch(callsUrl, callsInit);
    const { sessionId } = await createdSessionResponse.clone().json();
    const jwt = await new jose.SignJWT({
      sessionId
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(new TextEncoder().encode(token));

    const headers = new Headers(createdSessionResponse.headers);
    headers.append(
      "Set-Cookie",
      `partytracks-session-${sessionId}=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=${prefix};`
    );
    const newSessionResponse = new Response(createdSessionResponse.body, {
      ...createdSessionResponse,
      headers
    });
    return newSessionResponse;
  }

  const [sessionId] = previousUrl.pathname
    .replace(`${prefix}/sessions/`, "")
    .split("/");

  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return unauthorizedResponse();
  const sessionCookie = parse(cookieHeader)[`partytracks-session-${sessionId}`];
  if (!sessionCookie) return unauthorizedResponse();

  try {
    const result = await jose.jwtVerify(
      sessionCookie,
      new TextEncoder().encode(token)
    );
    invariant(result.payload.sessionId === sessionId);
  } catch (e) {
    return unauthorizedResponse();
  }
  return fetch(callsUrl, callsInit);
};
