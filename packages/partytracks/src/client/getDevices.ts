import {
  devices$,
  resilientTrack$,
  type ResilientTrackOptions
} from "./resilientTrack$";
import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import { broadcastSwitch } from "./broadcastSwitch";
import { BehaviorSubject, combineLatest, map, tap } from "rxjs";
import type { Observable } from "rxjs";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";
import { createDeviceManager } from "./devicePrioritization";

const getDevice =
  ({
    kind,
    defaultFallbackTrack$,
    retainIdleTrackDefaultValue
  }: {
    kind: "audioinput" | "videoinput";
    defaultFallbackTrack$: Observable<MediaStreamTrack>;
    retainIdleTrackDefaultValue: boolean;
  }) =>
  ({
    retainIdleTrack,
    broadcasting = false,
    trackTransform = async (track) => track,
    fallbackTrack$ = defaultFallbackTrack$,
    ...resilientTrackOptions
  }: {
    broadcasting?: boolean;
    trackTransform?: (track: MediaStreamTrack) => Promise<MediaStreamTrack>;
    /**
      This option keeps the device active even when not broadcasting. This
      should almost certainly ALWAYS be off for video since users expect the
      camera light to be off for re-assurance. For audio, if the
      localMonitorTrack is subscribed to the idle track is already retained.
      But consumers should not HAVE to implement the "talking while muted"
      notifications in order to benefit from the instant unmute that comes
      with keeping the track active even while muted.

      All that to say: if you want the mic to be released when stopBroadcasting
      is called, set this to false, and do not subscribe to the localMonitorTrack.
    */
    retainIdleTrack?: boolean;
    fallbackTrack$?: Observable<MediaStreamTrack>;
  } & Omit<ResilientTrackOptions, "kind"> = {}) => {
    const inputDevices$ = devices$.pipe(
      map((devices) => devices.filter((d) => d.kind === kind))
    );
    const deviceManager = createDeviceManager({
      localStorageNamespace: `partytracks-${kind}`,
      devices$: inputDevices$
    });
    const preferredDevice$ = new BehaviorSubject<MediaDeviceInfo | undefined>(
      undefined
    );

    const contentTrack$ = resilientTrack$({
      kind,
      devicePriority$: deviceManager.devicePriority$,
      onDeviceFailure: deviceManager.deprioritizeDevice,
      ...resilientTrackOptions
    }).pipe(
      tap((track) => {
        activeDeviceId$.next(track.getSettings().deviceId ?? "default");
      })
    );

    const { broadcastTrack$, localMonitorTrack$, ...broadcastApi } =
      broadcastSwitch({
        fallbackTrack$,
        contentTrack$,
        broadcasting,
        trackTransform
      });

    const activeDeviceId$ = new BehaviorSubject<string>("default");
    const activeDevice$ = combineLatest([activeDeviceId$, inputDevices$]).pipe(
      map(
        ([deviceId, devices]) =>
          devices.find((d) => d.deviceId === deviceId) ?? devices[0]
      )
    );

    return {
      devices$: inputDevices$,
      activeDevice$,
      preferredDevice$,
      setPreferredDevice: deviceManager.setPreferredDevice,
      ...broadcastApi,
      localMonitorTrack$,
      broadcastTrack$:
        // by using combineLatest for the localMonitorTrack, we ensure
        // a subscription is always active on the contentTrack$, keeping
        // it active even when not broadcasting.
        (retainIdleTrack ?? retainIdleTrackDefaultValue)
          ? combineLatest([broadcastTrack$, localMonitorTrack$]).pipe(
              map(([broadcastTrack]) => broadcastTrack)
            )
          : broadcastTrack$
    };
  };

export type Device = ReturnType<ReturnType<typeof getDevice>>;
export const getMic = getDevice({
  kind: "audioinput",
  defaultFallbackTrack$: inaudibleAudioTrack$,
  retainIdleTrackDefaultValue: true
});
export const getCamera = getDevice({
  kind: "videoinput",
  defaultFallbackTrack$: blackCanvasTrack$,
  retainIdleTrackDefaultValue: false
});
