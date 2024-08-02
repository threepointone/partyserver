import {
  createRequestHandler,
  createSessionStorage,
  logDevReady
} from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";
import { WorkerEntrypoint } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { getServerByName, routePartykitRequest, Server } from "partyserver";

import type {
  Cookie,
  CookieParseOptions,
  CookieSerializeOptions,
  Session
} from "@remix-run/cloudflare";

interface Env {
  RemixServer: DurableObjectNamespace<RemixServer>;
  // @ts-expect-error TODO: typescript hell
  SessionStorage: DurableObjectNamespace<SessionStorage>;
}

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: Env;
    session: SessionContext<unknown, Env>;
  }
}

const handleRemixRequest = createRequestHandler(build);

// @ts-expect-error we haven't loaded node's types for this yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
if (process.env.NODE_ENV === "development") {
  logDevReady(build);
}

function createServerSessionStorage<Data, Env>(options: {
  cookie?: Partial<Cookie>;
  useThisId?: string;
  namespace: DurableObjectNamespace<SessionStorage<Data, Env>>;
}) {
  return createSessionStorage<Data>({
    cookie: {
      name: "__session",
      sameSite: "lax",
      secrets: ["s3cret1"],
      ...options.cookie
    },
    async createData(data, expires) {
      const id = options.useThisId || nanoid();
      const stub = await getServerByName(options.namespace, id);
      // @ts-expect-error TODO: typescript hell
      await stub.createData(data, expires);
      return id;
    },
    // @ts-expect-error TODO: typescript hell
    async readData(id) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await getServerByName(options.namespace, id);
      return stub.readData();
    },
    async updateData(id, data, expires) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await getServerByName(options.namespace, id);
      // @ts-expect-error TODO: typescript hell
      await stub.updateData(data, expires);
    },
    async deleteData(id) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await getServerByName(options.namespace, id);
      await stub.deleteData();
    }
  });
}

// TODO: test the expiration stuff
export class SessionStorage<Data, Env> extends Server<Env> {
  async createData(data: Data, expires: Date | undefined): Promise<undefined> {
    // make sure `expires` is in the future
    if (expires && expires < new Date()) {
      throw new Error("Expiration date must be in the future");
    }

    await this.ctx.storage.put("data", data || {});
    await this.ctx.storage.put("expires", expires || null);
    if (expires) {
      await this.ctx.storage.setAlarm(expires);
    }
  }
  async readData(): Promise<Data | undefined> {
    const data = await this.ctx.storage.get<Data>("data");
    const expires = await this.ctx.storage.get<Date>("expires");
    if (expires && expires < new Date()) {
      await this.deleteData();
      return;
    }
    return data;
  }
  async updateData(data: Data, expires: Date | undefined): Promise<undefined> {
    await this.ctx.storage.put("data", data || {});
    await this.ctx.storage.put("expires", expires || null);
    if (expires) {
      await this.ctx.storage.setAlarm(expires);
    }
  }
  async deleteData(): Promise<undefined> {
    await this.ctx.storage.delete("data");
    await this.ctx.storage.delete("expires");
    await this.ctx.storage.deleteAlarm();
  }
  async alarm(): Promise<void> {
    await this.deleteData();
  }
}

type SessionContext<Data = unknown, FlashData = Data> = {
  get: () => Promise<Session<Data, FlashData>>;
  commit: (
    session: Session<Data, FlashData>,
    options: CookieSerializeOptions
  ) => Promise<string>;
  destroy: (
    session: Session<Data, FlashData>,
    options?: CookieSerializeOptions
  ) => Promise<string>;
};

export class RemixServer extends Server<Env> {
  sessions = createServerSessionStorage({
    // TODO typescript hell
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    namespace: this.env.SessionStorage
  });

  async fetch(request: Request) {
    return (
      //First let's check if the request is for a party
      // @ts-expect-error TODO: typescript hell
      (await routePartykitRequest(request, this.env)) ||
      // Otherwise let's just handle the request here
      super.fetch(request)
    );
  }

  async onRequest(request: Request): Promise<Response> {
    const session = {
      get: (options?: CookieParseOptions) => {
        return this.sessions.getSession(request.headers.get("Cookie"), options);
      },
      commit: async (session: Session, options: CookieSerializeOptions) => {
        if (!options.expires) {
          throw new Error(
            "Session must have an expiration date, or session objects will never be deleted."
          );
        }
        // @ts-expect-error TODO: typescript hell
        return this.sessions.commitSession(session, options);
      },
      destroy: async (session: Session, options?: CookieSerializeOptions) => {
        // @ts-expect-error TODO: typescript hell
        return this.sessions.destroySession(session, options);
      }
    };
    return handleRemixRequest(request, {
      env: this.env,
      // @ts-expect-error TODO: typescript hell
      session
    });
  }
}

export default class Worker extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    // we need to do this dance just to get the session id
    // from the request to route it to the correct Party

    const sessionStores = createServerSessionStorage({
      // TODO typescript hell
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      namespace: this.env.SessionStorage
    });

    // TODO: we just need the session id here, can we
    // parse it out of the cookie?
    const session = await sessionStores.getSession(
      request.headers.get("Cookie")
    );

    return (
      await getServerByName(this.env.RemixServer, session.id || nanoid())
    ).fetch(request);
  }
}
