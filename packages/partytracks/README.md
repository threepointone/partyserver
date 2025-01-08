## partytracks 🎶

```js
import { PartyTracks } from "partytracks";
import { of } from "rxjs";

// NOTE: >>>DO NOT<<< talk directly to the Calls API in your front-end in
// prod. You should run a proxy that will add the appropriate auth headers.
const CALLS_APP_ID = "YOUR_APP_ID_HERE";
const CALLS_APP_TOKEN = "YOUR_APP_TOKEN_HERE";
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
  // NOTE: >>>DO NOT<<< talk directly to the Calls API in your front-end in
  // prod. You should run a proxy that will add the appropriate auth headers.
  apiBase: `https://rtc.live.cloudflare.com/v1/apps/${CALLS_APP_ID}`,
  headers: new Headers({ Authorization: `Bearer ${CALLS_APP_TOKEN}` })
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
