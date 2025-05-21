import { Observable, shareReplay } from "rxjs";

const userGestureEvents = [
  "click",
  "contextmenu",
  "auxclick",
  "dblclick",
  "mousedown",
  "mouseup",
  "pointerup",
  "touchend",
  "keydown",
  "keyup"
];

let audioContextStartedPreviously = false;

export const inaudibleAudioTrack$ = new Observable<MediaStreamTrack>(
  (subscriber) => {
    const audioContext = new AudioContext();

    const oscillator = audioContext.createOscillator();
    oscillator.type = "triangle";
    // roughly sounds like a box fan
    oscillator.frequency.setValueAtTime(20, audioContext.currentTime);

    const gainNode = audioContext.createGain();
    // even w/ gain at 0 some packets are sent
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    oscillator.connect(gainNode);

    const destination = audioContext.createMediaStreamDestination();
    gainNode.connect(destination);

    const track = destination.stream.getAudioTracks()[0];

    let oscillatorStarted = false;
    const ensureOscillatorStarted = () => {
      if (oscillatorStarted) return;
      oscillator.start();
      oscillatorStarted = true;
    };

    const stateChangeHandler = () => {
      if (audioContext.state === "running") {
        audioContextStartedPreviously = true;
        ensureOscillatorStarted();
        subscriber.next(track);
      }
      if (
        audioContext.state === "suspended" ||
        (audioContext.state as string) === "interrupted"
      ) {
        resumeAudioContext();
      }
    };

    audioContext.addEventListener("statechange", stateChangeHandler);

    const resumeAudioContext = () => {
      audioContext.resume().then(() => {
        cleanUpUserGestureListeners();
      });
    };

    const cleanUpUserGestureListeners = () => {
      userGestureEvents.forEach((gesture) => {
        document.removeEventListener(gesture, resumeAudioContext, {
          capture: true
        });
      });
    };

    if (audioContextStartedPreviously) {
      resumeAudioContext();
    } else {
      userGestureEvents.forEach((gesture) => {
        document.addEventListener(gesture, resumeAudioContext, {
          capture: true
        });
      });
    }

    return () => {
      track.stop();
      audioContext.close();
      audioContext.removeEventListener("statechange", stateChangeHandler);
      cleanUpUserGestureListeners();
    };
  }
).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
