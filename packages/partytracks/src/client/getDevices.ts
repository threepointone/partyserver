import {
  devices$,
  resilientTrack$,
  type ResilientTrackOptions
} from "./resilientTrack$";
import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import { BehaviorSubject, map, tap } from "rxjs";
import type { Observable } from "rxjs";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";
import { createDeviceManager } from "./deviceManager";
import { makeBroadcastTrack, type BroadcastTrack } from "./makeBroadcastTrack";

interface GetDeviceOptions {
  kind: "audioinput" | "videoinput";
  fallbackTrack$: Observable<MediaStreamTrack>;
  retainIdleTrackDefaultValue: boolean;
}

interface MediaOptions {
  /**
  Whether or not the track broadcast by default.

  Default: false
  */
  broadcasting?: boolean;
  /**
  This option keeps the device active even when not broadcasting, so long
  as the device is enabled. This should almost certainly ALWAYS be off for
  video since users expect the camera light to be off for re-assurance.
  For audio, if the localMonitorTrack is subscribed to the idle track is
  already retained. But consumers should not HAVE to implement the "talking
  while muted" notifications in order to benefit from the instant unmute
  that comes with keeping the track active even while muted.

  All that to say: if you want the mic to be released when stopBroadcasting
  is called, set this to false, and do not subscribe to the localMonitorTrack.
  */
  retainIdleTrack?: boolean;
  /**
  Initial transformations for the track.
  */
  transformations?: ((
    track: MediaStreamTrack
  ) => Observable<MediaStreamTrack>)[];
  /**
  Whether or not enabled should be true initially. Defaults to true.
  */
  enabled?: boolean;
}

interface MediaDeviceOptions
  extends MediaOptions,
    Omit<ResilientTrackOptions, "kind" | "devicePriority$"> {}

const getDevice = ({
  kind,
  fallbackTrack$,
  retainIdleTrackDefaultValue
}: GetDeviceOptions) => {
  return ({
    enabled,
    transformations,
    retainIdleTrack,
    onDeviceFailure,
    constraints,
    broadcasting,
    ...resilientTrackOptions
  }: MediaDeviceOptions = {}): MediaDevice => {
    const inputDevices$ = devices$.pipe(
      map((devices) => devices.filter((d) => d.kind === kind))
    );
    const activeDeviceId$ = new BehaviorSubject<string>("default");
    const { devicePriority$, deprioritizeDevice, ...deviceManagerPublicApi } =
      createDeviceManager({
        localStorageNamespace: `partytracks-${kind}`,
        devices$: inputDevices$,
        activeDeviceId$
      });
    const sourceTrack$ = resilientTrack$({
      kind,
      devicePriority$,
      onDeviceFailure: (device) => {
        deprioritizeDevice(device);
        if (onDeviceFailure) onDeviceFailure(device);
      },
      ...resilientTrackOptions
    }).pipe(
      tap((track) =>
        activeDeviceId$.next(track.getSettings().deviceId ?? "default")
      )
    );
    const broadcastApi = makeBroadcastTrack({
      broadcasting,
      enabled,
      fallbackTrack$,
      contentTrack$: sourceTrack$,
      retainIdleTrack: retainIdleTrack ?? retainIdleTrackDefaultValue
    });

    return {
      ...broadcastApi,
      ...deviceManagerPublicApi
    };
  };
};

export interface MediaDevice extends BroadcastTrack {
  /**
   A list of available devices. Use this to create your device
   selection options.
   ```
   */
  devices$: Observable<MediaDeviceInfo[]>;
  /**
   The active device, if one has been acquired, otherwise the default.
   Use this to show your user which device is active in your device
   selection UI.
   */
  activeDevice$: Observable<MediaDeviceInfo>;
  /**
   Sets the user's preferred device. Once set, this is persisted to
   localStorage so that the preference can be remembered. When the
   preferred device is unavailable, all other availalble devices will
   be tried. If a preferred device *becomes* available, it will switch
   to the preferred device.
   */
  setPreferredDevice: (device: MediaDeviceInfo) => void;
}

export const getMic = getDevice({
  kind: "audioinput",
  fallbackTrack$: inaudibleAudioTrack$,
  retainIdleTrackDefaultValue: true
});

export const getCamera = getDevice({
  kind: "videoinput",
  fallbackTrack$: blackCanvasTrack$,
  retainIdleTrackDefaultValue: false
});
