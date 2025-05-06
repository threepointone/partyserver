import {
  devices$,
  resilientTrack$,
  type ResilientTrackOptions
} from "./resilientTrack$";
import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import {
  BehaviorSubject,
  combineLatest,
  map,
  tap,
  switchMap,
  delay,
  of,
  shareReplay
} from "rxjs";
import type { Observable } from "rxjs";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";
import { createDeviceManager } from "./devicePrioritization";
import { broadcastSwitch } from "./broadcastSwitch";

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
    fallbackTrack$ = defaultFallbackTrack$,
    transformations = [(track: MediaStreamTrack) => of(track)],
    enabled = true,
    ...resilientTrackOptions
  }: {
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
      What the fallback content track should be when broadcasting is false.
      For cameras, this defaults to a 1fps black screen. For mics this defaults
      to an inaudible audio track that has a very small (20hz wave) amount of
      noise on it to keep a small amount of data flowing.
      */
    fallbackTrack$?: Observable<MediaStreamTrack>;
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
  } & Omit<ResilientTrackOptions, "kind"> = {}): MediaDevice => {
    const inputDevices$ = devices$.pipe(
      map((devices) => devices.filter((d) => d.kind === kind))
    );
    const deviceManager = createDeviceManager({
      localStorageNamespace: `partytracks-${kind}`,
      devices$: inputDevices$
    });

    const transformationMiddleware$ = new BehaviorSubject<
      ((track: MediaStreamTrack) => Observable<MediaStreamTrack>)[]
    >(transformations);

    const sourceTrack$ = resilientTrack$({
      kind,
      devicePriority$: deviceManager.devicePriority$,
      onDeviceFailure: deviceManager.deprioritizeDevice,
      ...resilientTrackOptions
    }).pipe(
      tap((track) =>
        activeDeviceId$.next(track.getSettings().deviceId ?? "default")
      )
    );

    // NOTE: It might seems strange that we're using combineLatest here with
    // sourceTrack$ only to then wrap it with of() again below, but there is
    // a reason for this! By unwrapping it here, we can hold the same track
    // without releasing the device when transformationMiddleware$ emits a
    // new value.
    const contentTrack$ = combineLatest([
      transformationMiddleware$,
      sourceTrack$
    ]).pipe(
      switchMap(([transformations, sourceTrack]) =>
        transformations.reduce(
          (acc$, transformFn) => acc$.pipe(switchMap(transformFn)),
          of(sourceTrack)
        )
      ),
      // delay(0) here for React's StrictMode
      delay(0),
      shareReplay({
        refCount: true,
        bufferSize: 1
      })
    );

    const addTransform = (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => {
      transformationMiddleware$.next(
        transformationMiddleware$.value.concat(transform)
      );
    };

    const removeTransform = (
      transform: (track: MediaStreamTrack) => Observable<MediaStreamTrack>
    ) => {
      transformationMiddleware$.next(
        transformationMiddleware$.value.filter((t) => t !== transform)
      );
    };

    const { broadcastTrack$, localMonitorTrack$, ...broadcastApi } =
      broadcastSwitch({
        fallbackTrack$,
        contentTrack$,
        broadcasting,
        enabled
      });

    const activeDeviceId$ = new BehaviorSubject<string>("default");
    const activeDevice$ = combineLatest([activeDeviceId$, inputDevices$]).pipe(
      map(
        ([deviceId, devices]) =>
          devices.find((d) => d.deviceId === deviceId) ?? devices[0]
      )
    );

    return {
      addTransform,
      removeTransform,
      devices$: inputDevices$,
      activeDevice$,
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

export interface MediaDevice {
  /**
   Applies a transformation to the content track. Be sure to store
   a reference to the filter you've added if you want to remove it
   with removeTransform() and add cleanup logic when creating your
   Observable:
 
   ```ts
   track => new Observable<MediaStreamTrack>(subscriber => {
     // do your setup then emit...
     subscriber.next(transformedTrack)
     subscriber.add(() => {
       // add cleanup logic here
     })
   })
   ```
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
  /**
   Whether or not the device is currently broadcasting content.
   */
  isBroadcasting$: Observable<boolean>;
  /**
   Starts sending content from the device.
   */
  startBroadcasting: () => void;
  /**
   Stops sending content from the device.
   */
  stopBroadcasting: () => void;
  /**
   Toggles sending content from the device.
   */
  toggleBroadcasting: () => void;
  /**
   A monitor track that is "always on" for this device. You usually
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
   Whether or not the device is enabled. If disabled, the content source
   will not be requested, regardless of whether isBroadcasting is true
   or not. This can flip to false if an error is encountering acquiring
   content source. Default value is `true`.
   */
  enabled$: Observable<boolean>;
  /**
   Sets enabled to true.
   */
  enable: () => void;
  /**
   Sets enabled to false.
   */
  disable: () => void;
  /**
   Toggles enabled.
   */
  toggleEnabled: () => void;
  /**
   Emits errors encountered when acquiring content tracks.
   */
  error$: Observable<Error>;
}

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
