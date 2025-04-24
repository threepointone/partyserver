import { Observable } from "rxjs";

export const inaudibleAudioTrack$ = new Observable<MediaStreamTrack>(
  (subscriber) => {
    const audioContext = new window.AudioContext();

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

    const start = () => {
      oscillator.start();
      subscriber.next(track);
      document.removeEventListener("click", start, { capture: true });
      document.removeEventListener("keydown", start, { capture: true });
    };
    document.addEventListener("click", start, { capture: true, once: true });
    document.addEventListener("keydown", start, { capture: true, once: true });

    if (audioContext.state === "running") {
      start();
    }

    return () => {
      track.stop();
      audioContext.close();
      document.removeEventListener("click", start, { capture: true });
      document.removeEventListener("keydown", start, { capture: true });
    };
  }
);
