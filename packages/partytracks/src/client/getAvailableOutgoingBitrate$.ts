import { combineLatest, interval, map, switchMap } from "rxjs";

import { Ewma } from "./ewma";

import type { Observable } from "rxjs";

export function getAvailableOutboundEstimate$(
  peerConnection$: Observable<RTCPeerConnection>
) {
  const availableOutboundBitrateEwma = new Ewma(2000, 0);
  return combineLatest([peerConnection$, interval(5000)]).pipe(
    switchMap(([peerConnection]) => peerConnection.getStats()),
    map((newStatsReport) => {
      newStatsReport.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          "availableOutgoingBitrate" in report
        ) {
          availableOutboundBitrateEwma.insert(
            Number(report.availableOutgoingBitrate)
          );
        }
      });
      return availableOutboundBitrateEwma.value();
    })
  );
}
