import "./styles.css";

import {
  PartyTracks,
  getMic,
  getCamera,
  getScreenshare,
  createAudioSink
} from "partytracks/client";
import invariant from "tiny-invariant";

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const audio = document.getElementById("audio");
const micBroadcastButton = document.getElementById("mic-broadcast-button");
const micEnabledButton = document.getElementById("mic-enabled-button");
const cameraBroadcastButton = document.getElementById(
  "camera-broadcast-button"
);
const cameraEnabledButton = document.getElementById("camera-enabled-button");
const micSelect = document.getElementById("mic-select");
const cameraSelect = document.getElementById("camera-select");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);
invariant(audio instanceof HTMLAudioElement);
invariant(micBroadcastButton instanceof HTMLButtonElement);
invariant(micEnabledButton instanceof HTMLButtonElement);
invariant(cameraBroadcastButton instanceof HTMLButtonElement);
invariant(cameraEnabledButton instanceof HTMLButtonElement);
invariant(micSelect instanceof HTMLSelectElement);
invariant(cameraSelect instanceof HTMLSelectElement);

// MIC SETUP
// =====================================================================

const mic = getMic({ enabled: false });

micBroadcastButton.addEventListener("click", () => {
  mic.toggleBroadcasting();
});

mic.isBroadcasting$.subscribe((isBroadcasting) => {
  micBroadcastButton.innerText = isBroadcasting
    ? "mic is broadcasting"
    : "mic is not broadcasting";
});

micEnabledButton.addEventListener("click", () => {
  mic.toggleEnabled();
});

mic.enabled$.subscribe((enabled) => {
  micEnabledButton.innerText = enabled ? "mic is enabled" : "mic is disabled";
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

mic.activeDevice$.subscribe((d) => {
  micSelect.value = d?.deviceId ?? "default";
});

micSelect.onchange = (e) => {
  invariant(e.target instanceof HTMLSelectElement);
  const option = e.target.querySelector(`option[value="${e.target.value}"]`);
  invariant(option instanceof HTMLOptionElement);
  invariant(option.dataset.mediaDeviceInfo);
  mic.setPreferredDevice(JSON.parse(option.dataset.mediaDeviceInfo));
};

// Use localMonitorTrack$ to set up "talking while muted" notifications:
// mic.localMonitorTrack$.subscribe((track) => {
//   /* ... */
// });

// CAMERA SETUP
// =====================================================================

const camera = getCamera();

cameraBroadcastButton.addEventListener("click", () => {
  camera.toggleBroadcasting();
});

camera.isBroadcasting$.subscribe((isBroadcasting) => {
  cameraBroadcastButton.innerText = isBroadcasting
    ? "camera is broadcasting"
    : "camera is not broadcasting";
});

cameraEnabledButton.addEventListener("click", () => {
  camera.toggleEnabled();
});

camera.enabled$.subscribe((enabled) => {
  cameraEnabledButton.innerText = enabled
    ? "camera is enabled"
    : "camera is disabled";
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

camera.activeDevice$.subscribe((d) => {
  cameraSelect.value = d?.deviceId ?? "default";
});

cameraSelect.onchange = (e) => {
  invariant(e.target instanceof HTMLSelectElement);
  const option = e.target.querySelector(`option[value="${e.target.value}"]`);
  invariant(option instanceof HTMLOptionElement);
  invariant(option.dataset.mediaDeviceInfo);
  camera.setPreferredDevice(JSON.parse(option.dataset.mediaDeviceInfo));
};

// Screenshare Setup
// =====================================================================

const localScreenshareVideo = document.getElementById(
  "local-screenshare-video"
);
const remoteScreenshareVideo = document.getElementById(
  "remote-screenshare-video"
);
const screenshareAudioBroadcastButton = document.getElementById(
  "screenshare-audio-broadcast-button"
);
const screenshareAudioEnabledButton = document.getElementById(
  "screenshare-audio-enabled-button"
);
const screenshareVideoBroadcastButton = document.getElementById(
  "screenshare-video-broadcast-button"
);
const screenshareVideoEnabledButton = document.getElementById(
  "screenshare-video-enabled-button"
);

invariant(localScreenshareVideo instanceof HTMLVideoElement);
invariant(remoteScreenshareVideo instanceof HTMLVideoElement);
invariant(screenshareAudioBroadcastButton instanceof HTMLButtonElement);
invariant(screenshareAudioEnabledButton instanceof HTMLButtonElement);
invariant(screenshareVideoBroadcastButton instanceof HTMLButtonElement);
invariant(screenshareVideoEnabledButton instanceof HTMLButtonElement);

const screenshare = getScreenshare();

// screenshare.video.localMonitorTrack$.subscribe((track) => {
//   const ms = new MediaStream();
//   ms.addTrack(track);
//   localScreenshareVideo.srcObject = ms;
// });
//
// screenshare.video.broadcastTrack$.subscribe((track) => {
//   const ms = new MediaStream();
//   ms.addTrack(track);
//   localScreenshareVideo.srcObject = ms;
// });

screenshare.video.isBroadcasting$.subscribe((isBroadcasting) => {
  screenshareVideoBroadcastButton.innerText = `screenshare video is${isBroadcasting ? " " : " not "}broadcasting`;
});

screenshareVideoBroadcastButton.onclick = () => {
  screenshare.video.toggleBroadcasting();
};

// TODO: RENAME enabled$ to isEnabled$
screenshare.video.enabled$.subscribe((isEnabled) => {
  screenshareVideoEnabledButton.innerText = `screenshare video is${isEnabled ? " " : " not "}enabled`;
});

screenshareVideoEnabledButton.onclick = () => {
  screenshare.video.toggleEnabled();
};

// Push and pull tracks
// =====================================================================

const partyTracks = new PartyTracks();
const audioTrackMetadata$ = partyTracks.push(mic.broadcastTrack$);
const videoTrackMetadata$ = partyTracks.push(camera.broadcastTrack$);
const screenshareVideoTrackMetadata$ = partyTracks.push(
  screenshare.video.broadcastTrack$
);
const pulledAudioTrack$ = partyTracks.pull(audioTrackMetadata$);
const pulledVideoTrack$ = partyTracks.pull(videoTrackMetadata$);
const screensharePulledVideoTrack$ = partyTracks.pull(
  screenshareVideoTrackMetadata$
);

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

screenshare.video.localMonitorTrack$.subscribe((track) => {
  const localScreenshareVideoStream = new MediaStream();
  localScreenshareVideoStream.addTrack(track);
  localScreenshareVideo.srcObject = localScreenshareVideoStream;
});

screensharePulledVideoTrack$.subscribe((track) => {
  const remoteScreenshareVideoStream = new MediaStream();
  remoteScreenshareVideoStream.addTrack(track);
  remoteScreenshareVideo.srcObject = remoteScreenshareVideoStream;
});

const audioSink = createAudioSink({ audioElement: audio });
const pulledTrackSinkSubscription = audioSink.attach(pulledAudioTrack$);

// Remove track and unsubscribe by calling:
// pulledTrackSinkSubscription.unsubscribe();
