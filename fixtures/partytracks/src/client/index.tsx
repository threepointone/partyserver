import "./styles.css";

import { PartyTracks, experimentalDevices } from "partytracks/client";
import invariant from "tiny-invariant";

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const audio = document.getElementById("audio");
const micButton = document.getElementById("mic-button");
const cameraButton = document.getElementById("camera-button");
const micSelect = document.getElementById("mic-select");
const cameraSelect = document.getElementById("camera-select");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);
invariant(audio instanceof HTMLAudioElement);
invariant(micButton instanceof HTMLButtonElement);
invariant(cameraButton instanceof HTMLButtonElement);
invariant(micSelect instanceof HTMLSelectElement);
invariant(cameraSelect instanceof HTMLSelectElement);

// MIC SETUP
// =====================================================================

const mic = experimentalDevices.getMic();

mic.isBroadcasting$.subscribe((isBroadcasting) => {
  micButton.innerText = isBroadcasting ? "mic is on" : "mic is off";
});

micButton.addEventListener("click", () => {
  mic.toggleBroadcasting();
});

mic.activeDevice$.subscribe((d) => {
  micSelect.value = d?.deviceId ?? "default";
});

mic.devices$.subscribe((mics) => {
  micSelect.innerHTML = "";
  mics.forEach((mic) => {
    const option = document.createElement("option");
    option.value = mic.deviceId;
    option.innerText = mic.label;
    option.dataset.mediaDeviceInfo = JSON.stringify(mic);
    micSelect.appendChild(option);
  });
});

micSelect.onchange = (e) => {
  invariant(e.target instanceof HTMLSelectElement);
  const option = e.target.querySelector(`option[value="${e.target.value}"]`);
  invariant(option instanceof HTMLOptionElement);
  invariant(option.dataset.mediaDeviceInfo);
  mic.setPreferredDevice(JSON.parse(option.dataset.mediaDeviceInfo));
};

// optionally:
mic.localMonitorTrack$.subscribe((track) => {
  // set up "speaking while muted" listening/notifications
});

// CAMERA SETUP
// =====================================================================

const camera = experimentalDevices.getCamera({
  broadcasting: true
});

camera.isBroadcasting$.subscribe((isBroadcasting) => {
  cameraButton.innerText = isBroadcasting ? "camera is on" : "camera is off";
});

cameraButton.addEventListener("click", () => {
  camera.toggleBroadcasting();
});

camera.activeDevice$.subscribe((d) => {
  cameraSelect.value = d?.deviceId ?? "default";
});

camera.devices$.subscribe((cameras) => {
  cameraSelect.innerHTML = "";
  cameras.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.deviceId;
    option.innerText = c.label;
    option.dataset.mediaDeviceInfo = JSON.stringify(c);
    cameraSelect.appendChild(option);
  });
});

cameraSelect.onchange = (e) => {
  invariant(e.target instanceof HTMLSelectElement);
  const option = e.target.querySelector(`option[value="${e.target.value}"]`);
  invariant(option instanceof HTMLOptionElement);
  invariant(option.dataset.mediaDeviceInfo);
  camera.setPreferredDevice(JSON.parse(option.dataset.mediaDeviceInfo));
};

// Push and pull tracks
// =====================================================================

const partyTracks = new PartyTracks();
const audioTrackMetadata$ = partyTracks.push(mic.broadcastTrack$);
const videoTrackMetadata$ = partyTracks.push(camera.broadcastTrack$);
const pulledAudioTrack$ = partyTracks.pull(audioTrackMetadata$);
const pulledVideoTrack$ = partyTracks.pull(videoTrackMetadata$);

camera.broadcastTrack$.subscribe((track) => {
  const localMediaStream = new MediaStream();
  localMediaStream.addTrack(track);
  localVideo.srcObject = localMediaStream;
});

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
