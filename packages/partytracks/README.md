## partytracks 🎶

A utility library for [Cloudflare Calls](https://developers.cloudflare.com/calls/) built with RxJS Observables.

### Example

#### Client code:

```js
import { PartyTracks } from "partytracks/client";
import { of } from "rxjs";

const localVideo = document.querySelector("video.local-video");
const remoteVideo = document.querySelector("video.remote-video");

// Get webcam MediaStreamTrack from user
const webcamTrack = await navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((ms) => ms.getVideoTracks()[0]);

// Attach the webcam MediaStreamTrack to the "local video" for display
const localMediaStream = new MediaStream();
localMediaStream.addTrack(webcamTrack);
localVideo.srcObject = localMediaStream;

// Instantiate PartyTracks
const partyTracks = new PartyTracks({
  // this should point at the Calls API proxy shown below in the server code.
  apiBase: "/api/callsProxy"
});

// When pushing, you supply an Observable of a MediaStreamTrack, and you will
// receive an Observable of the metadata needed for someone else to pull that
// track. This metadata is a small POJO (Plain Old JavaScript Object) that can
// be serialized and sent to another user (usually via websocket).
const pushedTrackMetadata$ = partyTracks.push(of(webcamTrack));
// When pulling, you supply an Observable of the track metadata (from another
// user), and you will receive an Observable of that pulled MediaStreamTrack.
const pulledTrack$ = partyTracks.pull(pushedTrackMetadata$);

// Subscribing to the resulting Observable will trigger all of the WebRTC
// negotiation and the Observable will emit the track when it is ready.
const subscription = pulledTrack$.subscribe((track) => {
  // Attach the pulled MediaStreamTrack to the "remote video" for display
  const remoteMediaStream = new MediaStream();
  remoteMediaStream.addTrack(track);
  remoteVideo.srcObject = remoteMediaStream;
});

setTimeout(() => {
  // After 20 seconds, let's clean up by unsubscribing. This will close
  // the pulled track, and since our local demo is also pushing it will
  // close the pushed track as well since there are no other subscribers.
  subscription.unsubscribe();
}, 20000);
```

#### Server code:

In your server, you need to have a path that proxies all requests over to
the Cloudflare Calls API and provides your app id and token. In a worker,
it will look something like this:

```ts
import { Hono } from "hono";
import { proxyToCallsApi } from "partytracks/server";

type Bindings = {
  CALLS_APP_ID: string;
  CALLS_APP_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("/api/callsProxy/*", (c) =>
  proxyToCallsApi({
    replaceProxyPathname: "/api/callsProxy",
    appId: c.env.CALLS_APP_ID,
    token: c.env.CALLS_APP_TOKEN,
    request: c.req.raw
  })
);

export default app;
```

### Why Observables?

A promise based API (push a track, get a promise of metadata) seems simpler,
but proved to be a leaky abstraction when things go wrong. Sometimes a webcam
is unplugged, or your peer connection drops when switching networks. Observables
allow all of the logic of replacing/repairing tracks and connections to be
contained within the library, allowing your application code to not be concerned
with the details of WebRTC.
