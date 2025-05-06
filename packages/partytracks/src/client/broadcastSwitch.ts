import {
  BehaviorSubject,
  switchMap,
  shareReplay,
  tap,
  combineLatest,
  Subject
} from "rxjs";
import type { Observable } from "rxjs";

export const broadcastSwitch = (options: {
  contentTrack$: Observable<MediaStreamTrack>;
  fallbackTrack$: Observable<MediaStreamTrack>;
  broadcasting: boolean;
  enabled: boolean;
}) => {
  const enabled$ = new BehaviorSubject(options.enabled);
  const error$ = new Subject<Error>();
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
  const isBroadcasting$ = new BehaviorSubject(options.broadcasting);
  const startBroadcasting = () => {
    if (!isBroadcasting$.value) {
      enable();
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

  const tappedContentTrack$ = options.contentTrack$.pipe(
    tap({
      complete: () => {
        disable();
        stopBroadcasting();
      },
      error: (error) => {
        disable();
        stopBroadcasting();
        if (!(error instanceof Error)) throw error;
        error$.next(error);
      }
    })
  );

  const broadcastTrack$ = combineLatest([enabled$, isBroadcasting$]).pipe(
    switchMap(([enabled, isBroadcasting]) =>
      enabled && isBroadcasting ? tappedContentTrack$ : options.fallbackTrack$
    ),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  const localMonitorTrack$ = enabled$.pipe(
    switchMap((enabled) =>
      enabled ? tappedContentTrack$ : options.fallbackTrack$
    ),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );

  return {
    enabled$: enabled$.asObservable(),
    enable,
    disable,
    toggleEnabled,
    isBroadcasting$: isBroadcasting$.asObservable(),
    startBroadcasting,
    stopBroadcasting,
    toggleBroadcasting,
    error$,
    /**
      This is the track to push. It will send content
      while broadcasting, and send the fallback track
      when not broadcasting.
    */
    broadcastTrack$,
    /**
      Track for local use only. Useful for showing
      "talking while muted" notifications.
    */
    localMonitorTrack$
  };
};
