import { Observable, ReplaySubject, share } from "rxjs";
import invariant from "tiny-invariant";

export function screenshare$(options: DisplayMediaStreamOptions) {
  return new Observable<MediaStream>((subscriber) => {
    navigator.mediaDevices
      .getDisplayMedia(options)
      .then((ms) => {
        ms.getTracks().forEach((t) => {
          subscriber.add(() => t.stop());
          t.addEventListener("ended", () => {
            return subscriber.complete();
          });
        });
        subscriber.next(ms);
      })
      .catch((err) => {
        invariant(err instanceof Error);
        // user cancelled the screenshare request
        if (err.name === "NotAllowedError") {
          subscriber.complete();
          return;
        }
        subscriber.error(err);
      });
  }).pipe(
    // We basically want shareReplay({refCount: true, bufferSize:1})
    // but that doesn't allow for resetting on complete/error, so we
    // do this instead
    share({
      resetOnComplete: true,
      resetOnError: true,
      connector: () => new ReplaySubject(1)
    })
  );
}
