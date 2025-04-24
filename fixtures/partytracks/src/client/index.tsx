import "./styles.css";

import { PartyTracks, getMic, getCamera } from "partytracks/client";
import invariant from "tiny-invariant";

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const audio = document.getElementById("audio");
const micButton = document.getElementById("mic-button");
const cameraButton = document.getElementById("camera-button");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);
invariant(audio instanceof HTMLAudioElement);
invariant(micButton instanceof HTMLButtonElement);
invariant(cameraButton instanceof HTMLButtonElement);

// broadcasting is off by default
const mic = getMic();
// API (same for camera below):
// mic.startBroadcasting();
// mic.stopBroadcasting();
// mic.toggleBroadcasting();
// mic.isBroadcasting$
// mic.broadcastTrack$
// mic.monitorTrack$

mic.isBroadcasting$.subscribe((isBroadcasting) => {
  micButton.innerText = isBroadcasting ? "Mic is on" : "Mic is off";
});

micButton.addEventListener("click", () => {
  mic.toggleBroadcasting();
});

// optionally:
// mic.monitorTrack$.subscribe((track) => {
//   // set up "speaking while muted" listening/notifications
// });

const camera = getCamera({
  broadcasting: true,
  constraints: { height: { ideal: 720 } }
});
camera.isBroadcasting$.subscribe((isBroadcasting) => {
  cameraButton.innerText = isBroadcasting ? "Camera is on" : "Camera is off";
});
cameraButton.addEventListener("click", () => {
  camera.toggleBroadcasting();
});

// Use broadcastTrack$ locally so that webcam actually turns
// off when broadcasting is turned off.
camera.broadcastTrack$.subscribe((track) => {
  const localMediaStream = new MediaStream();
  localMediaStream.addTrack(track);
  localVideo.srcObject = localMediaStream;
});

const partyTracks = new PartyTracks();
const audioTrackMetadata$ = partyTracks.push(mic.broadcastTrack$);
const videoTrackMetadata$ = partyTracks.push(camera.broadcastTrack$);
const pulledAudioTrack$ = partyTracks.pull(audioTrackMetadata$);
const pulledVideoTrack$ = partyTracks.pull(videoTrackMetadata$);

pulledVideoTrack$.subscribe((track) => {
  const remoteMediaStream = new MediaStream();
  remoteMediaStream.addTrack(track);
  remoteVideo.srcObject = remoteMediaStream;
});

pulledAudioTrack$.subscribe((track) => {
  const ms = new MediaStream();
  ms.addTrack(track);
  audio.srcObject = ms;
  audio.play();
});
