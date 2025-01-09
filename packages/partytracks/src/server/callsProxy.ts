import invariant from "tiny-invariant";

interface Config {
  proxyPath: string;
  appId: string;
  token: string;
}

export const makeCallsProxyHandler = (config: Config) => (request: Request) => {
  const { headers, body, url, method } = request;

  // Forward headers while adding auth
  const newHeaders = new Headers(headers);
  newHeaders.set("Authorization", `Bearer ${config.token}`);
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
    config.proxyPath,
    `/v1/apps/${config.appId}`
  );
  callsUrl.search = previousUrl.search;

  return fetch(callsUrl, callsInit);
};
