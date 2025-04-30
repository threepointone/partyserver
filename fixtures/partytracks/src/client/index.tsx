import "./styles.css";
import { Observable } from "rxjs";

import { PartyTracks, partyTracksExperiments } from "partytracks/client";
import invariant from "tiny-invariant";

const { getMic, getCamera, createAudioSink } = partyTracksExperiments;

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

const createTransformation = (label: string) => (track: MediaStreamTrack) => {
  console.log(`${label} transformation Observable Created`);
  return new Observable<MediaStreamTrack>((sub) => {
    console.log(`Emiting ${label} transformed track`);
    sub.next(track);

    return () => {
      console.log(`Tearing down ${label} transformation`);
    };
  });
};

const transformations = {
  first: createTransformation("first"),
  second: createTransformation("second"),
  third: createTransformation("third")
};

const mic = getMic({
  transformations: [transformations.first]
});

setTimeout(() => {
  console.log("➕ ADDING SECOND TRANSFORM");
  mic.addTransform(transformations.second);
}, 1000);

setTimeout(() => {
  console.log("➕ ADDING THIRD TRANSFORM");
  mic.addTransform(transformations.third);
}, 2000);

setTimeout(() => {
  console.log("➖ removing first transform?");
  mic.removeTransform(transformations.first);
}, 3000);

setTimeout(() => {
  console.log("➖ removing second transform?");
  mic.removeTransform(transformations.second);
}, 4000);

setTimeout(() => {
  console.log("➖ removing third transform?");
  mic.removeTransform(transformations.third);
}, 5000);

micButton.addEventListener("click", () => {
  mic.toggleBroadcasting();
});

mic.isBroadcasting$.subscribe((isBroadcasting) => {
  micButton.innerText = isBroadcasting ? "mic is on" : "mic is off";
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

cameraButton.addEventListener("click", () => {
  camera.toggleBroadcasting();
});

camera.isBroadcasting$.subscribe((isBroadcasting) => {
  cameraButton.innerText = isBroadcasting ? "camera is on" : "camera is off";
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

const audioSink = createAudioSink({ audioElement: audio });
const pulledTrackSinkSubscription = audioSink.attach(pulledAudioTrack$);

// Remove track and unsubscribe by calling:
// pulledTrackSinkSubscription.unsubscribe()
