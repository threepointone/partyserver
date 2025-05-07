import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import { map, switchMap, of } from "rxjs";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";
import { screenshare$ } from "./screenshare$";
import { makeBroadcastTrack } from "./makeBroadcastTrack";

interface GetScreenshareOptions {
  audio?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          broadcasting?: boolean;
          enabled?: boolean;
          retainIdleTrack?: boolean;
        };
      };
  video?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          broadcasting?: boolean;
          enabled?: boolean;
          retainIdleTrack?: boolean;
        };
      };
}

const defaultAudioConfig = {
  constraints: {} as MediaTrackConstraints,
  options: { broadcasting: false, enabled: false, retainIdleTrack: false }
};

const defaultVideoConfig = {
  constraints: {} as MediaTrackConstraints,
  options: { broadcasting: false, enabled: false, retainIdleTrack: false }
};

export const getScreenshare = (options: GetScreenshareOptions = {}) => {
  const audioConstraints =
    options.audio === true || options.audio === undefined
      ? defaultAudioConfig.constraints
      : options.audio === false
        ? undefined
        : options.audio.constraints;
  const audioBroadcastOptions =
    options.audio === true || options.audio === undefined
      ? defaultAudioConfig.options
      : options.audio === false
        ? defaultAudioConfig.options
        : {
            ...defaultAudioConfig.options,
            ...options.audio.options
          };
  const videoConstraints =
    options.video === true || options.video === undefined
      ? defaultVideoConfig.constraints
      : options.video === false
        ? undefined
        : options.video.constraints;
  const videoBroadcastOptions =
    options.video === true || options.video === undefined
      ? defaultVideoConfig.options
      : options.video === false
        ? defaultVideoConfig.options
        : {
            ...defaultVideoConfig.options,
            ...options.video.options
          };
  // TODO: pass in options
  const screenshareSource$ = screenshare$({
    audio: audioConstraints,
    video: videoConstraints
  });

  const audioSourceTrack$ = screenshareSource$.pipe(
    switchMap((ms) => {
      const [track] = ms.getAudioTracks();
      return track ? of(track) : inaudibleAudioTrack$;
    })
  );

  const audio = makeBroadcastTrack({
    contentTrack$: audioSourceTrack$,
    fallbackTrack$: inaudibleAudioTrack$,
    ...audioBroadcastOptions
  });

  const videoSourceTrack$ = screenshareSource$.pipe(
    map((ms) => ms.getVideoTracks()[0])
  );

  const video = makeBroadcastTrack({
    contentTrack$: videoSourceTrack$,
    fallbackTrack$: blackCanvasTrack$,
    ...videoBroadcastOptions
  });

  return { audio, video };
};
