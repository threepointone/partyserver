import { routePartyTracksRequest } from "partytracks/server";

import type {
  ActionFunctionArgs,
  LoaderFunctionArgs
} from "@remix-run/server-runtime";

export const loader = ({ context, request }: LoaderFunctionArgs) => {
  return routePartyTracksRequest({
    appId: context.env.CALLS_APP_ID,
    token: context.env.CALLS_APP_TOKEN,
    request
  });
};

export const action = ({ context, request }: ActionFunctionArgs) => {
  return routePartyTracksRequest({
    appId: context.env.CALLS_APP_ID,
    token: context.env.CALLS_APP_TOKEN,
    request
  });
};
