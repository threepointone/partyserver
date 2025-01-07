## partycalls 🎶

```js
import { PartyTracks } from "partytracks";
import { of } from "rxjs";

const CALLS_APP_ID = "YOUR_APP_ID_HERE";
const CALLS_APP_TOKEN = "YOUR_APP_TOKEN_HERE";
const localVideo = document.querySelector("video.local-video");
const remoteVideo = document.querySelector("video.remote-video");

const webcamTrack = await navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((ms) => ms.getVideoTracks()[0]);

const localMediaStream = new MediaStream();
localMediaStream.addTrack(webcamTrack);
localVideo.srcObject = localMediaStream;

const partyTracks = new PartyTracks({
  // NOTE: Do not talk directly to the Calls API in your front-end in prod.
  // You should run a proxy that will add the appropriate auth headers.
  apiBase: `https://rtc.live.cloudflare.com/v1/apps/${CALLS_APP_ID}`,
  headers: new Headers({ Authorization: `Bearer ${CALLS_APP_TOKEN}` })
});

const pushedTrackMetadata$ = partyTracks.push(of(webcamTrack));
const pulledTrack$ = partyTracks.pull(pushedTrackMetadata$);

pulledTrack$.subscribe((track) => {
  const remoteMediaStream = new MediaStream();
  remoteMediaStream.addTrack(track);
  remoteVideo.srcObject = remoteMediaStream;
});
```
