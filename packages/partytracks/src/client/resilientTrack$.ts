import {
  concat,
  debounceTime,
  defer,
  distinctUntilChanged,
  from,
  fromEvent,
  map,
  merge,
  Observable,
  shareReplay,
  switchMap
} from "rxjs";

import { logger } from "./logging";
import { trackIsHealthy } from "./trackIsHealthy";

import type { Subscriber } from "rxjs";

export class DevicesExhaustedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Using defer here so that this doesn't blow up if it ends
// up in a server js bundle since navigator is browser api
export const devices$ = defer(() =>
  merge(
    from(navigator.mediaDevices.enumerateDevices()),
    fromEvent(navigator.mediaDevices, "devicechange").pipe(
      debounceTime(1500),
      switchMap(() => navigator.mediaDevices.enumerateDevices())
    )
  )
);

export interface ResilientTrackOptions {
  kind: "audioinput" | "videoinput";
  constraints?: MediaTrackConstraints;
  devicePriority$?: Observable<MediaDeviceInfo[]>;
  onDeviceFailure?: (device: MediaDeviceInfo) => void;
}

export const resilientTrack$ = ({
  kind,
  constraints = {},
  devicePriority$ = devices$,
  onDeviceFailure = () => {}
}: ResilientTrackOptions): Observable<MediaStreamTrack> =>
  devicePriority$
    .pipe(
      map((list) => list.filter((d) => d.kind === kind)),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    )
    .pipe(
      // switchMap on the outside here will cause the previous queue to stop
      // when the inputs change
      switchMap((deviceList) =>
        // concat here is going to make these be subscribed to sequentially
        concat(
          ...deviceList.map(
            (device) =>
              new Observable<MediaStreamTrack>((subscriber) => {
                const cleanupRef = { current: () => {} };
                acquireTrack(
                  subscriber,
                  device,
                  constraints,
                  cleanupRef,
                  onDeviceFailure
                );
                return () => {
                  cleanupRef.current();
                };
              })
          ),
          new Observable<MediaStreamTrack>((sub) =>
            sub.error(new DevicesExhaustedError())
          )
        )
      ),
      shareReplay({
        refCount: true,
        bufferSize: 1
      })
    );

function acquireTrack(
  subscriber: Subscriber<MediaStreamTrack>,
  device: MediaDeviceInfo,
  constraints: MediaTrackConstraints,
  cleanupRef: { current: () => void },
  onDeviceFailure: (device: MediaDeviceInfo) => void
) {
  const { deviceId, groupId, label } = device;
  logger.log(`🙏🏻 Requesting ${label}`);
  navigator.mediaDevices
    .getUserMedia(
      device.kind === "videoinput"
        ? { video: { ...constraints, deviceId, groupId } }
        : { audio: { ...constraints, deviceId, groupId } }
    )
    .then(async (mediaStream) => {
      const track =
        device.kind === "videoinput"
          ? mediaStream.getVideoTracks()[0]
          : mediaStream.getAudioTracks()[0];
      if (await trackIsHealthy(track)) {
        const cleanup = () => {
          logger.log("🛑 Stopping track");
          track.stop();
          document.removeEventListener("visibilitychange", onVisibleHandler);
        };
        const onVisibleHandler = async () => {
          if (document.visibilityState !== "visible") return;
          logger.log("Tab is foregrounded, checking health...");
          if (await trackIsHealthy(track)) return;
          logger.log("Reacquiring track");
          cleanup();
          acquireTrack(
            subscriber,
            device,
            constraints,
            cleanupRef,
            onDeviceFailure
          );
        };
        document.addEventListener("visibilitychange", onVisibleHandler);
        cleanupRef.current = cleanup;
        subscriber.next(track);
      } else {
        logger.log("☠️ track is not healthy, stopping");
        onDeviceFailure(device);
        track.stop();
        subscriber.complete();
      }
      track.addEventListener("ended", () => {
        logger.log("🔌 Track ended abrubptly");
        subscriber.complete();
      });
    })
    .catch((err) => {
      if (
        err instanceof Error &&
        // device not found, move on
        (err.name === "NotFoundError" ||
          // this device is in use already, probably on Windows
          // so we can just call this one complete and move on
          err.name === "NotReadableError")
      ) {
        subscriber.complete();
      } else {
        subscriber.error(err);
      }
    });
}
