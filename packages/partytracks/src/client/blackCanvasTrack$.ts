import { Observable, shareReplay } from "rxjs";
import invariant from "tiny-invariant";

export const blackCanvasTrack$ = new Observable<MediaStreamTrack>(
  (subscriber) => {
    const canvas = document.createElement("canvas");
    canvas.height = 720;
    canvas.width = 1280;
    const ctx = canvas.getContext("2d");
    invariant(ctx);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // we need to draw to the canvas in order for video
    // frames to be sent on the video track
    setInterval(() => {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 1000);
    const track = canvas.captureStream().getVideoTracks()[0];
    track.addEventListener("ended", () => {
      subscriber.complete();
    });
    subscriber.add(() => {
      track.stop();
    });
    subscriber.next(track);
  }
).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
