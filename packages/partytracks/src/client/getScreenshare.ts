import { inaudibleAudioTrack$ } from "./inaudibleTrack$";
import { map, switchMap, of, BehaviorSubject } from "rxjs";
import { blackCanvasTrack$ } from "./blackCanvasTrack$";
import { screenshare$ } from "./screenshare$";
import { makeBroadcastTrack, type BroadcastTrack } from "./makeBroadcastTrack";

interface GetScreenshareOptions {
  /**
  Whether isSourceEnabled should be initially true.
  Defaults to false.
  */
  activateSource?: boolean;
  retainIdleTrack?: boolean;
  audio?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          broadcasting?: boolean;
        };
      };
  video?:
    | boolean
    | {
        constraints?: MediaTrackConstraints;
        options?: {
          broadcasting?: boolean;
        };
      };
}

const defaultAudioConfig = {
  constraints: {} as MediaTrackConstraints,
  options: { broadcasting: false }
};

const defaultVideoConfig = {
  constraints: {} as MediaTrackConstraints,
  options: { broadcasting: false }
};

const defaultOptions = {
  activateSource: false,
  retainIdleTrack: false
} satisfies GetScreenshareOptions;

export const getScreenshare = (
  options: GetScreenshareOptions = defaultOptions
) => {
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

  const isSourceEnabled$ = new BehaviorSubject(
    options.activateSource ?? defaultOptions.activateSource
  );

  const audioApi = makeBroadcastTrack({
    contentTrack$: audioSourceTrack$,
    fallbackTrack$: inaudibleAudioTrack$,
    ...defaultOptions,
    retainIdleTrack: options.retainIdleTrack,
    isSourceEnabled$,
    ...audioBroadcastOptions
  });

  const audio: Partial<typeof audioApi> = {
    ...audioApi
  };

  delete audio.toggleIsSourceEnabled;
  delete audio.disableSource;
  delete audio.enableSource;

  const videoSourceTrack$ = screenshareSource$.pipe(
    map((ms) => ms.getVideoTracks()[0])
  );

  const videoApi = makeBroadcastTrack({
    contentTrack$: videoSourceTrack$,
    fallbackTrack$: blackCanvasTrack$,
    retainIdleTrack: options.retainIdleTrack,
    isSourceEnabled$,
    ...videoBroadcastOptions
  });

  const video: Partial<typeof videoApi> = {
    ...videoApi
  };

  delete video.toggleIsSourceEnabled;
  delete video.disableSource;
  delete video.enableSource;

  const disableSource = () => {
    audioApi.disableSource();
    videoApi.disableSource();
  };

  const enableSource = () => {
    audioApi.enableSource();
    videoApi.enableSource();
  };

  const toggleIsSourceEnabled = () => {
    audioApi.toggleIsSourceEnabled();
    videoApi.toggleIsSourceEnabled();
  };

  return {
    audio: audio as Omit<
      BroadcastTrack,
      "enableSource" | "disableSource" | "toggleIsSourceEnabled"
    >,
    video: video as Omit<
      BroadcastTrack,
      "enableSource" | "disableSource" | "toggleIsSourceEnabled"
    >,
    disableSource,
    enableSource,
    toggleIsSourceEnabled
  };
};
