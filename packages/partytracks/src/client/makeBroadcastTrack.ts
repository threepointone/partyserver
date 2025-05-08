import {
  BehaviorSubject,
  combineLatest,
  map,
  of,
  shareReplay,
  Subject,
  switchMap,
  tap
} from "rxjs";
import { Observable } from "rxjs";

export interface MakeBroadcastTrackOptions {
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
  TODO: Document
  */
  contentTrack$: Observable<MediaStreamTrack>;
  /**
  What the fallback content track should be when broadcasting is false.
  For cameras, this defaults to a 1fps black screen. For mics this defaults
  to an inaudible audio track that has a very small (20hz wave) amount of
  noise on it to keep a small amount of data flowing.
  */
  fallbackTrack$: Observable<MediaStreamTrack>;
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

export const makeBroadcastTrack = ({
  retainIdleTrack,
  broadcasting = false,
  fallbackTrack$,
  contentTrack$,
  transformations = [(track: MediaStreamTrack) => of(track)],
  enabled = true
}: MakeBroadcastTrackOptions): BroadcastTrack => {
  const transformationMiddleware$ = new BehaviorSubject<
    ((track: MediaStreamTrack) => Observable<MediaStreamTrack>)[]
  >(transformations);

  const enabled$ = new BehaviorSubject(enabled);
  const enable = () => {
    if (!enabled$.value) enabled$.next(true);
  };
  const disable = () => {
    if (enabled$.value) {
      enabled$.next(false);
      stopBroadcasting();
    }
  };
  const toggleEnabled = () => {
    if (enabled$.value) {
      disable();
    } else {
      enable();
    }
  };

  const isBroadcasting$ = new BehaviorSubject(broadcasting);
  const startBroadcasting = () => {
    enable();
    if (!isBroadcasting$.value) {
      isBroadcasting$.next(true);
    }
  };
  const stopBroadcasting = () => {
    if (isBroadcasting$.value) isBroadcasting$.next(false);
  };
  const toggleBroadcasting = () => {
    if (isBroadcasting$.value) {
      stopBroadcasting();
    } else {
      startBroadcasting();
    }
  };

  const error$ = new Subject<Error>();

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

  const enabledContent$ = enabled$.pipe(
    switchMap((enabled) =>
      enabled
        ? contentTrack$.pipe(
            tap({
              complete: () => {
                disable();
              },
              error: (error) => {
                disable();
                if (!(error instanceof Error)) throw error;
                error$.next(error);
              }
            }),
            // Important to apply the middleware AFTER tapping the content for
            // completion and errors, since the inner observable of switchMap
            // will not propagate to the outer observable.
            (source$: Observable<MediaStreamTrack>) =>
              // NOTE: It might seems strange that we're using combineLatest here with
              // source$ only to then wrap it with of() again below, but there is a
              // reason for this! By unwrapping it here, we can hold the same track
              // without releasing the device when transformationMiddleware$ emits a
              // new value.
              combineLatest([transformationMiddleware$, source$]).pipe(
                switchMap(([transformations, source]) =>
                  transformations.reduce(
                    (acc$, transformFn) => acc$.pipe(switchMap(transformFn)),
                    of(source)
                  )
                )
              )
          )
        : fallbackTrack$
    )
  );

  const broadcastTrack$ = combineLatest([enabled$, isBroadcasting$]).pipe(
    switchMap(([enabled, isBroadcasting]) =>
      enabled && isBroadcasting ? enabledContent$ : fallbackTrack$
    ),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  const localMonitorTrack$ = enabled$.pipe(
    switchMap((enabled) => (enabled ? enabledContent$ : fallbackTrack$)),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  return {
    enable,
    disable,
    toggleEnabled,
    error$,
    enabled$: enabled$.asObservable(),
    addTransform,
    removeTransform,
    isBroadcasting$,
    startBroadcasting,
    stopBroadcasting,
    toggleBroadcasting,
    localMonitorTrack$,
    broadcastTrack$:
      // by using combineLatest for the localMonitorTrack, we ensure
      // a subscription is always active on the contentTrack$, keeping
      // it active even when not broadcasting.
      retainIdleTrack
        ? combineLatest([broadcastTrack$, localMonitorTrack$]).pipe(
            map(([broadcastTrack]) => broadcastTrack)
          )
        : broadcastTrack$
  };
};

export interface BroadcastTrack {
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
