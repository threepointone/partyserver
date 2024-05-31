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
  const data = useLoaderData<typeof loader>();
  console.log(data);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix + Partyflare!</h1>
      <ul>
        <li>
          <a
            target="_blank"
            href="https://developers.cloudflare.com/workers/"
            rel="noreferrer"
          >
            Cloudflare Workers Docs
          </a>
        </li>
        <li>
          <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
            Remix Docs
          </a>
        </li>
      </ul>
    </div>
  );
}
