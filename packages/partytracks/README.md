# partytracks

Audio/video handling for realtime apps using Observables for WebRTC using [Cloudflare Realtime SFU](https://developers.cloudflare.com/realtime/introduction/).

## Installation

```shell
npm install partytracks
```

## Features

- **Observable-based API** - Better handling of WebRTC complexities
- **Automatic Recovery** - Handles disconnects, hardware changes, and network switches
- **Abstracted Complexity** - Application code doesn't need to handle WebRTC details

## Why Observables?

A promise-based API (push a track, get a promise of metadata) seems simpler but proved to be a leaky abstraction when things go wrong. Sometimes a webcam is unplugged, or your peer connection drops when switching networks. Observables allow all of the logic of replacing/repairing tracks and connections to be contained within the library, allowing your application code to not be concerned with the details of WebRTC.

## Usage

### Client code:

```js
// needed to smooth out cross browser behavior inconsistencies
import "webrtc-adapter";

import { PartyTracks, resilientTrack$ } from "partytracks/client";
import { of } from "rxjs";

const localVideo = document.querySelector("video.local-video");
const remoteVideo = document.querySelector("video.remote-video");

// resilientTrack$ will follow a prioritized list of devices and
// try them in order, checking track health and re-evaluating
// when available devices change
const track$ = resilientTrack$({ kind: "videoinput" });

// Subscribe so that we can receive updates if the track changes,
// for example if a webcam is unplugged.
track$.subscribe((track) => {
  // Attach the webcam MediaStreamTrack to the "local video" for display
  const localMediaStream = new MediaStream();
  localMediaStream.addTrack(track);
  localVideo.srcObject = localMediaStream;
});

// Instantiate PartyTracks
const partyTracks = new PartyTracks();

// When pushing, you supply an Observable of a MediaStreamTrack, and you will
// receive an Observable of the metadata needed for someone else to pull that
// track. This metadata is a small POJO (Plain Old JavaScript Object) that can
// be serialized and sent to another user (usually via websocket).
const pushedTrackMetadata$ = partyTracks.push(track$);
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

### Server code:

In your server, you need to have a path that proxies all requests over to
the Cloudflare Realtime SFU API and provides your app id and token. In a worker,
it will look something like this:

```ts
import { Hono } from "hono";
import { routePartyTracksRequest } from "partytracks/server";

type Bindings = {
  CALLS_APP_ID: string;
  CALLS_APP_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("/partytracks/*", (c) =>
  routePartyTracksRequest({
    appId: c.env.CALLS_APP_ID,
    token: c.env.CALLS_APP_TOKEN,
    request: c.req.raw
  })
);

export default app;
```

### React utils

If you're building using React, there are a few utilities you may find helpful.

By convention, Observables have a $ suffix to indicate that they're an Observable.

```ts
import {
  useObservableAsValue,
  useObservable,
  useValueAsObservable
} from "partytracks/react";

function SomeComponent({ value }) {
  // creates a stable observable that will
  // emit when a new value is passed in
  const value$ = useValueAsObservable(value);
  // subscribes and gives you the latest value
  // second arg is the default value if nothing
  // has been emitted yet
  const latestValue = useObservableAsValue(value$, "default value");
  // Allows for hooking into new values, errors, and completion.
  useObservable(value$, {
    next: (v) => console.log(v),
    error: (e) => console.error(e),
    complete: () => console.log("complete!")
  });
}
```

## API Reference

### PartyTracks

The `PartyTracks` class handles all WebRTC negotiations through `push` and `pull` methods.

```ts
class PartyTracks {
  constructor(config?: PartyTracksConfig);
  /**
     Pushes a track to the Realtime SFU. If the sourceTrack$ emits a new
     track after the initial one, the new track will replace the old one
     on the transceiver. Same with sendEncodings$, the initial values will
     be applied, and subsequent emissions will be applied.
  
     Additionally, if the peerConnection is disrupted and session$ emits
     a new peerConnection/sessionId combo, the track will be re-pushed,
     and will emit new TrackMetadata
     */
  push(
    sourceTrack$: Observable<MediaStreamTrack>,
    options?: {
      sendEncodings$?: Observable<RTCRtpEncodingParameters[]>;
    }
  ): Observable<TrackMetadata>;

  /**
     Pulls a track from the Realtime SFU. If trackData$ emits new TrackMetadata
     or if the peerConnection is disrupted and session$ emits a new
     peerConnection/sessionId combo, the track will be re-pulled, and will emit
     a new MediaStreamTrack.
    */
  pull(
    trackData$: Observable<TrackMetadata>,
    options?: {
      simulcast?: {
        preferredRid$: Observable<string | undefined>;
      };
    }
  ): Observable<MediaStreamTrack>;

  /**
     An observable of the active peerConnection. If the active peerConnection
     is disrupted, a new one will be created and emitted
     */
  peerConnection$: Observable<RTCPeerConnection>;

  /**
     An observable of the active peerConnection and its associated sessionId.
     This flows from the peerConnection$, and will emit with the new peerConnection
     and a new sessionId when the peerConnection changes.
     */
  session$: Observable<{
    peerConnection: RTCPeerConnection;
    sessionId: string;
  }>;

  /**
     Emits transceivers each time they are added  to the peerConnection.
     */
  transceiver$: Observable<RTCRtpTransceiver>;
  /**
     An observable of the peerConnection's connectionState.
     */
  peerConnectionState$: Observable<RTCPeerConnectionState>;
  /**
     Useful for logging/debugging purposes.
     */
  history: History<ApiHistoryEntry>;
}
```

### `getMic` and `getCamera`

These both accept `MediaDeviceOptions`:

```ts
interface MediaDeviceOptions {
  /**
  Whether or not the track broadcast by default.

  Default: false
  */
  broadcasting?: boolean;
  /**
  Keeps the track source active regardless of whether there are any subscribers
  to either localMonitorTrack$ or broadcastTrack$.

  Defaults to true for mic and false for camera.
  */
  retainIdleTrack?: boolean;
  /**
  Initial transformations for the track.
  */
  transformations?: ((
    track: MediaStreamTrack
  ) => Observable<MediaStreamTrack>)[];
  /**
  Whether or not isSourceEnabled should be true initially. Defaults to true.
  */
  activateSource?: boolean;
  /**
  Constraints for the device. This is passed into
  navigator.mediaDevices.getUserMedia(). deviceId and groupId are excluded
  because _all_ devices will be tried eventually if the preferred device
  is not available.
  */
  constraints?: Omit<MediaTrackConstraints, "deviceId" | "groupId">;
  /**
  A callback to be notified when an individual device fails to produce
  a healthy track. Useful for potentially surfacing messages to the user, or
  for optionally deprioritizing the device in the future.
  */
  onDeviceFailure?: (device: MediaDeviceInfo) => void;
}
```

And they both return a `MediaDevice`:

```ts
interface MediaDevice {
  /**
   * The permission state of the device.
   */
  permissionState$: Observable<SafePermissionState>;
  /**
   A list of available devices. Use this to create your device
   selection options.
   */
  devices$: Observable<MediaDeviceInfo[]>;
  /**
   The active device, if one has been acquired, otherwise the preferred
   device, otherwise the default device. Use this to show your user which
   device is active in your device selection UI.
   */
  activeDevice$: Observable<MediaDeviceInfo>;
  /**
   Sets the user's preferred device. Once set, this is persisted to
   localStorage so that the preference can be remembered. When the
   preferred device is unavailable, all other availalble devices will
   be tried. If the preferred device *becomes* available, it will switch
   to the preferred device.
   */
  setPreferredDevice: (device: MediaDeviceInfo) => void;
  /**
   Applies a transformation to the content track. Be sure to store
   a reference to the filter you've added if you want to remove it
   with removeTransform() and add cleanup logic when creating your
   Observable:
 
   track => new Observable<MediaStreamTrack>(subscriber => {
     // do your setup then emit...
     subscriber.next(transformedTrack)
     subscriber.add(() => {
       // add cleanup logic here
     })
   })
   */
  addTransform: (
    transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
  ) => void;
  /**
   Removes a previously applied transformation.
   */
  removeTransform: (
    transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
  ) => void;
  /**
   Whether or not the source is currently broadcasting content.
   */
  isBroadcasting$: Observable<boolean>;
  /**
   Starts sending content from the source. Will call enableSource()
   if it's not already enabled.
   */
  startBroadcasting: () => void;
  /**
   Stops sending content from the source.
   */
  stopBroadcasting: () => void;
  /**
   Toggles sending content from the source.
   */
  toggleBroadcasting: () => void;
  /**
   A monitor track that is "always on" for this source. You usually
   only want this for your mic so that you can show "talking while muted"
   notifications. Users have a STRONG sensitivity to the webcam light
   being on even when the content might not be broadcasting, so it
   is not recommended to use this for cameras unless your users have
   a solid understanding of whether or not the content is being sent.
   */
  localMonitorTrack$: Observable<MediaStreamTrack>;
  /**
   The track that is to be pushed with PartyTracks.push(). This track
   will switch from the content track to a fallback (empty) track when
   broadcasting is stopped.
   */
  broadcastTrack$: Observable<MediaStreamTrack>;
  /**
   Whether or not the source is enabled. If disabled, the content source
   will not be requested, regardless of whether isBroadcasting is true
   or not. This can flip to false if an error is encountering acquiring
   content source, or if the source completes (e.g. screenshare ended).
   Default value is `true`.
   */
  isSourceEnabled$: Observable<boolean>;
  /**
   Sets isSourceEnabled to true.
   */
  enableSource: () => void;
  /**
   Sets isSourceEnabled to false. Will also call stopBroadcasting() if
   it is broadcasting.
   */
  disableSource: () => void;
  /**
   Toggles isSourceEnabled.
   */
  toggleIsSourceEnabled: () => void;
  /**
   Emits errors encountered when acquiring source. Most likely to either be
   DevicesExhaustedError (a partytracks custom error) or NotAllowedError.
   */
  error$: Observable<Error>;
}
```

### getScreenshare

`getScreenshare` accepts `ScreenshareOptions`:

```ts
interface ScreenshareOptions {
  /**
  Whether isSourceEnabled should be initially true.
  Defaults to false.
  */
  activateSource?: boolean;
  /**
  Whether or not tracks should be retained even if there are no
  active subscribers to the content source. (For example, if isBroadcasting$
  is false, and localMonitorTrack$ has no subscribers)
  */
  retainIdleTracks?: boolean;
  audio?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          /**
          Whether or not the track should be broadcasting to start
          */
          broadcasting?: boolean;
        };
      };
  video?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          /**
          Whether or not the track should be broadcasting to start
          */
          broadcasting?: boolean;
        };
      };
}
```

It returns a `Screenshare` interface which is quite similar to the `MediaDevice` API above,
except that the tracks API's are split between `audio` and `video`, and the `isSourceEnabled`
related API's are on the top level since the source is shared between both tracks.

```ts
interface Screenshare {
  audio: {
    /**
    Applies a transformation to the content track. Be sure to store
    a reference to the filter you've added if you want to remove it
    with removeTransform() and add cleanup logic when creating your
    Observable:
  
    track => new Observable<MediaStreamTrack>(subscriber => {
      // do your setup then emit...
      subscriber.next(transformedTrack)
      subscriber.add(() => {
        // add cleanup logic here
      })
    })
    */
    addTransform: (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => void;
    /**
    Removes a previously applied transformation.
    */
    removeTransform: (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => void;
    /**
    Whether or not the source is currently broadcasting content.
    */
    isBroadcasting$: Observable<boolean>;
    /**
    Starts sending content from the source. Will call enableSource()
    if it's not already enabled.
    */
    startBroadcasting: () => void;
    /**
    Stops sending content from the source.
    */
    stopBroadcasting: () => void;
    /**
    Toggles sending content from the source.
    */
    toggleBroadcasting: () => void;
    /**
    A monitor track that is "always on" for this source. You usually
    only want this for your mic so that you can show "talking while muted"
    notifications. Users have a STRONG sensitivity to the webcam light
    being on even when the content might not be broadcasting, so it
    is not recommended to use this for cameras unless your users have
    a solid understanding of whether or not the content is being sent.
    */
    localMonitorTrack$: Observable<MediaStreamTrack>;
    /**
    The track that is to be pushed with PartyTracks.push(). This track
    will switch from the content track to a fallback (empty) track when
    broadcasting is stopped.
    */
    broadcastTrack$: Observable<MediaStreamTrack>;
    /**
    Emits errors encountered when acquiring source. Most likely to either be
    DevicesExhaustedError (a partytracks custom error) or NotAllowedError.
    */
    error$: Observable<Error>;
  };
  video: {
    /**
    Applies a transformation to the content track. Be sure to store
    a reference to the filter you've added if you want to remove it
    with removeTransform() and add cleanup logic when creating your
    Observable:
  
    track => new Observable<MediaStreamTrack>(subscriber => {
      // do your setup then emit...
      subscriber.next(transformedTrack)
      subscriber.add(() => {
        // add cleanup logic here
      })
    })
    */
    addTransform: (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => void;
    /**
    Removes a previously applied transformation.
    */
    removeTransform: (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => void;
    /**
    Whether or not the source is currently broadcasting content.
    */
    isBroadcasting$: Observable<boolean>;
    /**
    Starts sending content from the source. Will call enableSource()
    if it's not already enabled.
    */
    startBroadcasting: () => void;
    /**
    Stops sending content from the source.
    */
    stopBroadcasting: () => void;
    /**
    Toggles sending content from the source.
    */
    toggleBroadcasting: () => void;
    /**
    A monitor track that is "always on" for this source. You usually
    only want this for your mic so that you can show "talking while muted"
    notifications. Users have a STRONG sensitivity to the webcam light
    being on even when the content might not be broadcasting, so it
    is not recommended to use this for cameras unless your users have
    a solid understanding of whether or not the content is being sent.
    */
    localMonitorTrack$: Observable<MediaStreamTrack>;
    /**
    The track that is to be pushed with PartyTracks.push(). This track
    will switch from the content track to a fallback (empty) track when
    broadcasting is stopped.
    */
    broadcastTrack$: Observable<MediaStreamTrack>;
    /**
    Emits errors encountered when acquiring source. Most likely to either be
    DevicesExhaustedError (a partytracks custom error) or NotAllowedError.
    */
    error$: Observable<Error>;
  };

  /**
   Whether or not the source is enabled. If disabled, the content source
   will not be requested, regardless of whether isBroadcasting is true
   or not. This can flip to false if an error is encountering acquiring
   content source, or if the source completes (e.g. screenshare ended).
   Default value is `true`.
   */
  isSourceEnabled$: Observable<boolean>;
  /**
   Sets isSourceEnabled to true.
   */
  enableSource: () => void;
  /**
   Sets isSourceEnabled to false. Will also call stopBroadcasting() if
   it is broadcasting.
   */
  disableSource: () => void;
  /**
   Toggles isSourceEnabled.
   */
  toggleIsSourceEnabled: () => void;
}
```

### createAudioSink

It's recommended to use `createAudioSink` for your pulled audio tracks
to play the audio. This utility handles certain edge-cases to ensure that
audio playback works as expected.

```ts
import { createAudioSink, PartyTracks } from "partytracks";
import { of } from "rxjs";

const audioElement = document.querySelector("audio");
const audioSink = createAudioSink({ audioElement });
const partyTracks = new PartyTracks();
const audioTrackMetadata$ = of({
  // track metadata...
});
const pulledAudioTrack$ = partyTracks.pull(audioTrackMetadata$);
// No need to "detatch", unsubscribing from pulledTrackSinkSubscription
// will do the appropriate cleanup.
const pulledTrackSinkSubscription = audioSink.attach(pulledAudioTrack$);
```
