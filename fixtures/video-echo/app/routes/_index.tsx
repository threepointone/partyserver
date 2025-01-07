import { useLoaderData } from "@remix-run/react";

import type {
  LoaderFunction,
  LoaderFunctionArgs,
  MetaFunction
} from "@remix-run/cloudflare";

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
  return Response.json({ hello: "world" });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      {JSON.stringify(data)}
    </div>
  );
}
