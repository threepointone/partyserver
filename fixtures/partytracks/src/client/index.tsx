import "./styles.css";

import { PartyTracks } from "partytracks";
import { of } from "rxjs";
import invariant from "tiny-invariant";

const form = document.getElementById("form");
invariant(form instanceof HTMLFormElement);
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);

form.addEventListener("submit", async function setup(ev) {
  ev.preventDefault();
  const formData = new FormData(form);
  const apiToken = formData.get("apiToken") as string;
  const appId = formData.get("appId") as string;

  const webcamTrack = await navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((ms) => ms.getVideoTracks()[0]);

  const localMediaStream = new MediaStream();
  localMediaStream.addTrack(webcamTrack);
  localVideo.srcObject = localMediaStream;

  const partyTracks = new PartyTracks({
    // NOTE: Do not talk directly to the Calls API in your front-end in prod.
    // You should run a proxy that will add the appropriate auth headers.
    apiBase: `https://rtc.live.cloudflare.com/v1/apps/${appId}`,
    headers: new Headers({ Authorization: `Bearer ${apiToken}` })
  });

  const pushedTrack$ = partyTracks.push(of(webcamTrack));
  const pulledTrack$ = partyTracks.pull(pushedTrack$);

  pulledTrack$.subscribe((track) => {
    const remoteMediaStream = new MediaStream();
    remoteMediaStream.addTrack(track);
    remoteVideo.srcObject = remoteMediaStream;
  });
});
