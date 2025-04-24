import { BehaviorSubject, switchMap, type Observable } from "rxjs";
import { resilientTrack$, type ResilientTrackOptions } from "./resilientTrack$";
import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";

export const broadcastSwitch = (options: {
  contentTrack$: Observable<MediaStreamTrack>;
  fallbackTrack$: Observable<MediaStreamTrack>;
  broadcasting?: boolean;
}) => {
  let isBroadcasting = options.broadcasting ?? true;
  const isBroadcasting$ = new BehaviorSubject(isBroadcasting);

  const startBroadcasting = () => {
    isBroadcasting = true;
    isBroadcasting$.next(isBroadcasting);
  };

  const stopBroadcasting = () => {
    isBroadcasting = false;
    isBroadcasting$.next(isBroadcasting);
  };

  const toggleBroadcasting = () => {
    isBroadcasting = !isBroadcasting;
    isBroadcasting$.next(isBroadcasting);
  };

  const broadcastTrack$ = isBroadcasting$.pipe(
    switchMap((enabled) =>
      enabled ? options.contentTrack$ : options.fallbackTrack$
    )
  );

  return {
    isBroadcasting$,
    startBroadcasting,
    stopBroadcasting,
    toggleBroadcasting,
    broadcastTrack$,
    /**
      Track for local use only. Especially useful for showing
      "talking while muted" notifications.
    */
    monitorTrack$: options.contentTrack$
  };
};

export const getMic = ({
  broadcasting = false,
  ...resilientTrackOptions
}: { broadcasting?: boolean } & Omit<ResilientTrackOptions, "kind"> = {}) => {
  return broadcastSwitch({
    contentTrack$: resilientTrack$({
      kind: "audioinput",
      ...resilientTrackOptions
    }),
    fallbackTrack$: inaudibleAudioTrack$,
    broadcasting
  });
};

export const getCamera = ({
  broadcasting = false,
  ...resilientTrackOptions
}: { broadcasting?: boolean } & Omit<ResilientTrackOptions, "kind"> = {}) => {
  return broadcastSwitch({
    contentTrack$: resilientTrack$({
      kind: "videoinput",
      constraints: {
        height: { ideal: 1080 }
      },
      ...resilientTrackOptions
    }),
    fallbackTrack$: blackCanvasTrack$,
    broadcasting
  });
};
