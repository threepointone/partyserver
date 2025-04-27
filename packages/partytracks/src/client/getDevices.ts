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

export const getDevice =
  ({
    kind,
    fallbackTrack$
  }: {
    kind: "audioinput" | "videoinput";
    fallbackTrack$: Observable<MediaStreamTrack>;
  }) =>
  ({
    broadcasting = false,
    trackTransform = async (track) => track,
    ...resilientTrackOptions
  }: {
    broadcasting?: boolean;
    trackTransform?: (track: MediaStreamTrack) => Promise<MediaStreamTrack>;
  } & Omit<ResilientTrackOptions, "kind"> = {}) => {
    const inputDevices$ = devices$.pipe(
      map((devices) => devices.filter((d) => d.kind === kind))
    );
    const preferredDevice$ = new BehaviorSubject<MediaDeviceInfo | undefined>(
      undefined
    );

    const devicePriority$ = combineLatest([
      inputDevices$,
      preferredDevice$
    ]).pipe(
      map(([devices, preferredDevice]) =>
        preferredDevice ? [preferredDevice, ...devices] : devices
      )
    );
    const setPreferredDevice = (device: MediaDeviceInfo) =>
      preferredDevice$.next(device);

    const contentTrack$ = resilientTrack$({
      kind,
      devicePriority$,
      ...resilientTrackOptions
    }).pipe(
      tap((track) => {
        activeDeviceId$.next(track.getSettings().deviceId ?? "default");
      })
    );

    const broadcastApi = broadcastSwitch({
      fallbackTrack$,
      contentTrack$,
      broadcasting,
      trackTransform
    });

    const activeDeviceId$ = new BehaviorSubject<string>("default");
    const activeDevice$ = combineLatest([activeDeviceId$, devices$]).pipe(
      map(([deviceId, devices]) => devices.find((d) => d.deviceId === deviceId))
    );

    return {
      devices$: inputDevices$,
      activeDevice$,
      preferredDevice$,
      setPreferredDevice,
      ...broadcastApi
    };
  };

export type Device = ReturnType<ReturnType<typeof getDevice>>;
export const getMic = getDevice({
  kind: "audioinput",
  fallbackTrack$: inaudibleAudioTrack$
});
export const getCamera = getDevice({
  kind: "videoinput",
  fallbackTrack$: blackCanvasTrack$
});
