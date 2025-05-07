import { Observable, shareReplay, delay } from "rxjs";
import invariant from "tiny-invariant";

export function screenshare$(
  options: DisplayMediaStreamOptions = { audio: true }
) {
  return new Observable<MediaStream>((subscribe) => {
    navigator.mediaDevices
      .getDisplayMedia(options)
      .then((ms) => {
        subscribe.add(() => {
          ms.getTracks().forEach((t) => t.stop());
        });

        subscribe.next(ms);
        ms.getVideoTracks()[0].addEventListener("ended", () => {
          console.log("ENDED FIRED, COMPLETING");
          subscribe.complete();
        });
      })
      .catch((err) => {
        invariant(err instanceof Error);
        // user cancelled the screenshare request
        if (err.name === "NotAllowedError") {
          subscribe.complete();
          return;
        }
        subscribe.error(err);
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
