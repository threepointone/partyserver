import "./styles.css";

import { PartyTracks, resilientTrack$ } from "partytracks/client";
import invariant from "tiny-invariant";

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
invariant(localVideo instanceof HTMLVideoElement);
invariant(remoteVideo instanceof HTMLVideoElement);

const track$ = resilientTrack$({ kind: "videoinput" });

track$.subscribe((track) => {
  const localMediaStream = new MediaStream();
  localMediaStream.addTrack(track);
  localVideo.srcObject = localMediaStream;
});

const partyTracks = new PartyTracks();
const pushedTrack$ = partyTracks.push(track$);
const pulledTrack$ = partyTracks.pull(pushedTrack$);

pulledTrack$.subscribe((track) => {
  const remoteMediaStream = new MediaStream();
  remoteMediaStream.addTrack(track);
  remoteVideo.srcObject = remoteMediaStream;
});
