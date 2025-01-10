import { proxyToCallsApi } from "partytracks/server";

import type {
  ActionFunctionArgs,
  LoaderFunctionArgs
} from "@remix-run/server-runtime";

export const loader = ({ context, request }: LoaderFunctionArgs) => {
  return proxyToCallsApi({
    replaceProxyPathname: "/api/calls",
    appId: context.env.CALLS_APP_ID,
    token: context.env.CALLS_APP_TOKEN,
    request
  });
};

export const action = ({ context, request }: ActionFunctionArgs) => {
  return proxyToCallsApi({
    replaceProxyPathname: "/api/calls",
    appId: context.env.CALLS_APP_ID,
    token: context.env.CALLS_APP_TOKEN,
    request
  });
};
