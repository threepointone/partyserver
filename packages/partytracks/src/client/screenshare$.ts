import { Observable } from "rxjs";
import invariant from "tiny-invariant";

export function screenshare$(options: DisplayMediaStreamOptions) {
  return new Observable<MediaStream>((subscriber) => {
    navigator.mediaDevices
      .getDisplayMedia(options)
      .then((ms) => {
        ms.getTracks().forEach((t) => {
          subscriber.add(() => t.stop());
          t.addEventListener("ended", () => {
            console.log("ENDED?!");
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
  });
}
