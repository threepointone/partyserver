import invariant from "tiny-invariant";

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
   * For example, if your proxy path is /api/calls/*, the value should be "/api/calls"
   */
  replaceProxyPathname: string;
  /**
   * The original request
   */
  request: Request;
}

export const proxyToCallsApi = ({
  appId,
  token,
  replaceProxyPathname,
  request
}: Config) => {
  const { headers, body, url, method } = request;

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

  const previousUrl = new URL(url);
  const callsUrl = new URL("https://rtc.live.cloudflare.com");
  callsUrl.pathname = previousUrl.pathname.replace(
    replaceProxyPathname,
    `/v1/apps/${appId}`
  );
  callsUrl.search = previousUrl.search;

  return fetch(callsUrl, callsInit);
};
