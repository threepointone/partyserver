import { Observable, shareReplay, delay } from "rxjs";
import invariant from "tiny-invariant";

export function getScreenshare$() {
  return new Observable<MediaStream | undefined>((subscribe) => {
    navigator.mediaDevices
      .getDisplayMedia()
      .then((ms) => {
        subscribe.add(() => {
          ms.getTracks().forEach((t) => t.stop());
        });

        subscribe.next(ms);
        ms.getVideoTracks()[0].addEventListener("ended", () => {
          subscribe.complete();
        });
      })
      .catch((err) => {
        invariant(err instanceof Error);
        // user cancelled the screenshare request
        if (err.name === "NotAllowedError") {
          subscribe.next(undefined);
          return;
        }
        throw err;
      });
  }).pipe(
    // delay(0) for React strict mode
    delay(0),
    shareReplay({
      refCount: true,
      bufferSize: 1
    })
  );
}
