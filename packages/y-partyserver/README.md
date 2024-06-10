## y-partyserver

A [Yjs](https://docs.yjs.dev/) backend for [PartyServer](https://npmjs.com/package/partyserver). Build collaborative text editors and more, powered by [Durable Objects](https://developers.cloudflare.com/durable-objects/)!

Step 1: Define your server as a subclass of `YjsServer`

```ts
import { YjsServer } from "y-partyserver";

// define your YjsServer Durable Object
export default class Document extends YjsServer {
  // optionally load / save with a database
  async onSave() {
    // this.document is a Y.Doc instance
    // that you can serialise to your database
  }

  async onLoad() {
    // this is called ONCE when the server "starts" up
    // you can apply any state to this.document
  }
}

// wire it up to your fetch handler
export {
  async fetch(request: Request): Promise<Response> {
    return (
      // this will route requests to /parties/document/:id
      // to the Document Durable Object
      (await Server.partyFetch(request, this.env)) ||
      new Response("Not Found", { status: 404 })
    );
  }
}


```

Step 2: Configure `wrangler.toml`

```toml
[[durable_objects.bindings]]
name = "Document"
class_name = "Document"

[[migrations]]
tag = "v1" # Should be unique for each entry
new_classes = ["Document"]
```

Step 3: Connect from your client. Check your editor's documentation for how to connect to a Yjs server.
