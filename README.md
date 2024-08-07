## 🎈 PartyServer

_Much like life, this is a Work in Progress._

Libraries / Examples / Documentation for building real-time apps (and more!) with [Cloudflare Workers](https://workers.cloudflare.com/). Powered by Durable Objects, Inspired by [PartyKit](https://www.partykit.io/).

This is the main repository for PartyServer. It contains the following packages:

[PartyServer](/packages/partyserver/README.md) - The core library for building real-time applications with Durable Objects. This library adds a boilerplate code on to a standard Durable Object that makes it easier to work with when using WebSockets, as well as adding some additional features like lifecycle hooks and broadcasting.

[Y-PartyServer](/packages/y-partyserver/README.md) - A library that adds Yjs support to PartyServer. Yjs is a CRDT library that allows for real-time collaborative editing. This library exposes a base class extending PartyServer that adds Yjs support, with utility hooks for loading/saving Yjs documents from any external storage.

[🥖 partysub](/packages/partysub/README.md) - A library for doing pubsub at scale with PartyServer. It lets you configure a "room" to be baccked by N separate Duable Object instances, and a strategy for spreading the laod across the world concentrated in configurable locations.

### Fixtures

We have a set of small examples for PartyServer in the [`fixtures`](/fixtures/) directory. These are small, self-contained examples that demonstrate how to use PartyServer in different ways. We will expand this repository with broader (and deeper!) examples in the future.

Reach out to [@threepointone on twitter](https://twitter.com/threepointone) or the [Cloudflare Workers Discord](https://discord.com/invite/cloudflaredev) to follow progress, and if you have any questions or feedback.
