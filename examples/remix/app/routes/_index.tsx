import React, { Suspense } from "react";
import { ClientOnly } from "remix-utils/client-only";

import type {
  LoaderFunction,
  LoaderFunctionArgs,
  MetaFunction
} from "@remix-run/cloudflare";

const Tldraw = React.lazy(() => import("../tldraw/client/App"));

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    {
      name: "description",
      content: "Welcome to Remix! Using Vite and Cloudflare Workers!"
    }
  ];
};

export const loader: LoaderFunction = async ({
  // request,
  context
}: LoaderFunctionArgs) => {
  const session = await context.session.get();
  let cookieHeader;
  if (!session.id) {
    cookieHeader = await context.session.commit(session, {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    });
  }
  return Response.json(
    { hello: "world" },
    {
      headers: {
        ...(cookieHeader ? { "Set-Cookie": cookieHeader } : {})
      }
    }
  );
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <Suspense fallback={<div>Loading...</div>}>
        <ClientOnly>{() => <Tldraw />}</ClientOnly>
      </Suspense>
    </div>
  );
}
