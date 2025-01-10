import "./styles.css";

import { PartyTracks } from "partytracks/client";
import { of } from "rxjs";
import invariant from "tiny-invariant";

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);

const webcamTrack = await navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((ms) => ms.getVideoTracks()[0]);

const localMediaStream = new MediaStream();
localMediaStream.addTrack(webcamTrack);
localVideo.srcObject = localMediaStream;

const partyTracks = new PartyTracks({ apiBase: "/api/calls" });

const pushedTrack$ = partyTracks.push(of(webcamTrack));
const pulledTrack$ = partyTracks.pull(pushedTrack$);

pulledTrack$.subscribe((track) => {
  const remoteMediaStream = new MediaStream();
  remoteMediaStream.addTrack(track);
  remoteVideo.srcObject = remoteMediaStream;
});
