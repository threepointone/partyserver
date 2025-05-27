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
import type { Observable } from "rxjs";
import { handoffMap } from "./handoffMap";

export interface MakeBroadcastTrackOptions {
  /**
  Whether or not the track broadcast by default.

  Default: false
  */
  broadcasting?: boolean;
  isBroadcasting$?: BehaviorSubject<boolean>;
  /**
  This option keeps the source active even when not broadcasting, so long
  as the source is enabled. This should almost certainly ALWAYS be off for
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
  The main content track that will be the source for both broadcastTrack$ and
  localMonitorTrack$.
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
  This needs to be a BehaviorSubject so that multiple tracks can share
  the same enabled state (needed for screenshare API for example, which
  may produce two tracks, audio and video, and when one is disabled, they
  both are)
  */
  isSourceEnabled$?: BehaviorSubject<boolean>;
}

export const makeBroadcastTrack = ({
  retainIdleTrack,
  broadcasting = false,
  fallbackTrack$,
  contentTrack$,
  transformations = [(track: MediaStreamTrack) => of(track)],
  isSourceEnabled$ = new BehaviorSubject(true),
  isBroadcasting$ = new BehaviorSubject(broadcasting)
}: MakeBroadcastTrackOptions): BroadcastTrack => {
  const transformationMiddleware$ = new BehaviorSubject<
    ((track: MediaStreamTrack) => Observable<MediaStreamTrack>)[]
  >(transformations);

  const enableSource = () => {
    if (!isSourceEnabled$.value) isSourceEnabled$.next(true);
  };
  const disableSource = () => {
    if (isSourceEnabled$.value) {
      isSourceEnabled$.next(false);
      stopBroadcasting();
    }
  };
  const toggleIsSourceEnabled = () => {
    if (isSourceEnabled$.value) {
      disableSource();
    } else {
      enableSource();
    }
  };

  const startBroadcasting = () => {
    enableSource();
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

  const enabledContent$ = isSourceEnabled$.pipe(
    switchMap((enabled) =>
      enabled
        ? contentTrack$.pipe(
            tap({
              complete: () => {
                disableSource();
              },
              error: (error) => {
                disableSource();
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
              // without releasing the source when transformationMiddleware$ emits a
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

  const broadcastTrack$ = combineLatest([
    isSourceEnabled$,
    isBroadcasting$,
    // unwrapping and re-wrapping the fallbackTrack to keep it active so
    // that we don't recreate it each time isBroadcasting is toggled
    fallbackTrack$
  ]).pipe(
    handoffMap(([enabled, isBroadcasting, fallbackTrack]) =>
      enabled && isBroadcasting ? enabledContent$ : of(fallbackTrack)
    ),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  const localMonitorTrack$ = isSourceEnabled$.pipe(
    handoffMap((enabled) => (enabled ? enabledContent$ : fallbackTrack$)),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  return {
    error$,
    enableSource,
    disableSource,
    toggleIsSourceEnabled,
    isSourceEnabled$: isSourceEnabled$.asObservable(),
    addTransform,
    removeTransform,
    isBroadcasting$: isBroadcasting$.asObservable(),
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
