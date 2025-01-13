import { useMemo, useRef, useState } from "react";
import { useIsServer } from "~/hooks/useIsServer";
import { getUserMediaTrack$ } from "~/utils/rxjs/getUserMediaTrack$";
import { PartyTracks } from "partytracks/client";
import { useObservableAsValue, useOnEmit } from "partytracks/react";
import { map, shareReplay } from "rxjs";

import type { ComponentProps, ComponentRef } from "react";
import type { Observable } from "rxjs";

export default function Component() {
  const isServer = useIsServer();
  if (isServer) return null;
  return <ClientOnlyDemo />;
}

function ClientOnlyDemo() {
  const [localFeedOn, setLocalFeedOn] = useState(true);
  const [remoteFeedOn, setRemoteFeedOn] = useState(false);
  const partyTracks = useMemo(() => new PartyTracks(), []);

  const peerConnectionState = useObservableAsValue(
    partyTracks.peerConnectionState$,
    "new"
  );

  const sessionId = useObservableAsValue(
    useMemo(
      () => partyTracks.session$.pipe(map((x) => x.sessionId)),
      [partyTracks.session$]
    ),
    null
  );

  const localVideoTrack$ = useWebcamTrack$(localFeedOn);
  const localMicTrack$ = useMicTrack$(localFeedOn);
  const remoteVideoTrack$ = useMemo(() => {
    if (!localVideoTrack$ || !remoteFeedOn) return null;
    return partyTracks.pull(partyTracks.push(localVideoTrack$));
  }, [partyTracks, remoteFeedOn, localVideoTrack$]);
  const remoteAudioTrack$ = useMemo(() => {
    if (!localMicTrack$ || !remoteFeedOn) return null;
    return partyTracks.pull(partyTracks.push(localMicTrack$));
  }, [partyTracks, remoteFeedOn, localMicTrack$]);

  return (
    <div className="p-2 flex flex-col gap-3">
      <div className="flex gap-2">
        <Button onClick={() => setLocalFeedOn(!localFeedOn)}>
          Turn Local {localFeedOn ? "Off" : "On"}
        </Button>
        <Button onClick={() => setRemoteFeedOn(!remoteFeedOn)}>
          Turn Remote {remoteFeedOn ? "Off" : "On"}
        </Button>
      </div>
      <div className="grid xl:grid-cols-2">
        {localVideoTrack$ && localFeedOn && (
          <Video videoTrack$={localVideoTrack$} />
        )}
        {localMicTrack$ && localFeedOn && (
          <Audio audioTrack$={localMicTrack$} />
        )}
        {remoteVideoTrack$ && remoteFeedOn && (
          <Video videoTrack$={remoteVideoTrack$} />
        )}
        {remoteAudioTrack$ && remoteFeedOn && (
          <Audio audioTrack$={remoteAudioTrack$} />
        )}
      </div>
      <pre>{JSON.stringify({ peerConnectionState, sessionId }, null, 2)}</pre>
    </div>
  );
}

function Button(props: ComponentProps<"button">) {
  return <button className="border px-1" {...props} />;
}

function Video(props: { videoTrack$: Observable<MediaStreamTrack | null> }) {
  const ref = useRef<ComponentRef<"video">>(null);
  useOnEmit(props.videoTrack$, (track) => {
    if (!ref.current) return;
    if (track) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(track);
      ref.current.srcObject = mediaStream;
    } else {
      ref.current.srcObject = null;
    }
  });

  return (
    <video className="h-full w-full" ref={ref} autoPlay muted playsInline />
  );
}

function Audio(props: { audioTrack$: Observable<MediaStreamTrack | null> }) {
  const ref = useRef<ComponentRef<"audio">>(null);
  useOnEmit(props.audioTrack$, (track) => {
    if (!ref.current) return;
    if (track) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(track);
      ref.current.srcObject = mediaStream;
    } else {
      ref.current.srcObject = null;
    }
  });

  // biome-ignore lint/a11y/useMediaCaption: Not able to generate captions for this currently.
  return <audio className="h-full w-full" ref={ref} autoPlay playsInline />;
}

function useWebcamTrack$(enabled: boolean) {
  return useMemo(() => {
    if (!enabled) return null;
    return getUserMediaTrack$("videoinput").pipe(
      shareReplay({
        refCount: true,
        bufferSize: 1
      })
    );
  }, [enabled]);
}

function useMicTrack$(enabled: boolean) {
  return useMemo(() => {
    if (!enabled) return null;
    return getUserMediaTrack$("audioinput").pipe(
      shareReplay({
        refCount: true,
        bufferSize: 1
      })
    );
  }, [enabled]);
}
