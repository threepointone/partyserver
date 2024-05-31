import {
  createRequestHandler,
  createSessionStorage,
  logDevReady
} from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";
import { WorkerEntrypoint } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { Party } from "partyflare";

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
// @ts-expect-error process isn't a global yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
if (process.env.NODE_ENV === "development") {
  logDevReady(build);
}

function createPartySessionStorage<Data, Env>(options: {
  cookie?: Partial<Cookie>;
  useThisId?: string;
  party: DurableObjectNamespace<SessionStorage<Data, Env>>;
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
      const stub = await Party.withRoom(options.party, id);
      // @ts-expect-error TODO: typescript hell
      await stub.createData(data, expires);
      return id;
    },
    // @ts-expect-error TODO: typescript hell
    async readData(id) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await Party.withRoom(options.party, id);
      return stub.readData();
    },
    async updateData(id, data, expires) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await Party.withRoom(options.party, id);
      // @ts-expect-error TODO: typescript hell
      await stub.updateData(data, expires);
    },
    async deleteData(id) {
      if (options.useThisId && id !== options.useThisId) {
        throw new Error("Invalid session id");
      }
      const stub = await Party.withRoom(options.party, id);
      await stub.deleteData();
    }
  });
}

export class SessionStorage<Data, Env> extends Party<Env> {
  async createData(data: Data, expires: Date | undefined): Promise<undefined> {
    // TODO: test `expires` is in the future?
    await this.ctx.storage.put("data", data || {});
    await this.ctx.storage.put("expires", expires || null);
    // TODO: set alarm for `expires`?
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
    // TODO: update alarm for `expires`?
  }
  async deleteData(): Promise<undefined> {
    await this.ctx.storage.delete("data");
    await this.ctx.storage.delete("expires");
    // TODO: delete alarm for `expires`?
  }
  alarm(): void | Promise<void> {
    // TODO: this is where you'd wipe out old sessions
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

export class RemixServer extends Party<Env> {
  sessions = createPartySessionStorage({
    // TODO typescript hell
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    party: this.env.SessionStorage
  });

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

    const sessionStores = createPartySessionStorage({
      // TODO typescript hell
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      party: this.env.SessionStorage
    });

    // TODO: we just need the session id here, can we
    // parse it out of the cookie?
    const session = await sessionStores.getSession(
      request.headers.get("Cookie")
    );

    const stub = await Party.withRoom(
      this.env.RemixServer,
      session.id || nanoid()
    );
    return stub.fetch(request);
  }
}
