// import { mode } from "~/utils/mode";
import { combineLatest, interval, map, pairwise, switchMap } from "rxjs";

import { Ewma } from "./ewma";

import type { Observable } from "rxjs";

export interface PacketLossStats {
  inboundPacketLossPercentage: number;
  outboundPacketLossPercentage: number;
}

export function getPacketLossStats$(
  peerConnection$: Observable<RTCPeerConnection>
) {
  const inboundPacketLossPercentageEwma = new Ewma(2000, 0);
  const outboundPacketLossPercentageEwma = new Ewma(2000, 0);
  let anycastWarned = false;
  return combineLatest([peerConnection$, interval(1000)]).pipe(
    switchMap(([peerConnection]) => peerConnection.getStats()),
    pairwise(),
    map(([previousStatsReport, newStatsReport]) => {
      let inboundPacketsReceived = 0;
      let inboundPacketsLost = 0;
      let outboundPacketsSent = 0;
      let outboundPacketsLost = 0;
      let candidatePairID: string | undefined = undefined;
      let remoteCandidateID: string | undefined = undefined;
      let remoteAddress: string | undefined = undefined;

      newStatsReport.forEach((report) => {
        // @ts-expect-error RTCStatsReport types are busted
        const previous = previousStatsReport.get(report.id);
        if (!previous) return;

        if (report.type === "transport") {
          candidatePairID = report.selectedCandidatePairId;
        }
        if (candidatePairID) {
          remoteCandidateID =
            // @ts-expect-error RTCStatsReport types are busted
            newStatsReport.get(candidatePairID)?.remoteCandidateId;
        }
        if (remoteCandidateID) {
          // @ts-expect-error RTCStatsReport types are busted
          remoteAddress = newStatsReport.get(remoteCandidateID).address;
        }
        if (remoteAddress !== undefined && remoteAddress !== "141.101.90.0") {
          console.warn(
            "PeerConnection doesn't appear to be connected to anycast 141.101.90.0"
          );
          if (process.env.NODE_ENV === "production" && !anycastWarned) {
            alert("You are not connected to CF anycast address");
            anycastWarned = true;
          }
        }

        if (report.type === "inbound-rtp") {
          inboundPacketsLost += report.packetsLost - previous.packetsLost;
          inboundPacketsReceived +=
            report.packetsReceived - previous.packetsReceived;
        } else if (report.type === "outbound-rtp") {
          const packetsSent = report.packetsSent - previous.packetsSent;
          // Find the corresponding remote-inbound-rtp report

          const remoteInboundReport = Array.from(
            // @ts-expect-error RTCStatsReport types are busted
            newStatsReport.values()
          ).find((r) => {
            // @ts-expect-error RTCStatsReport types are busted
            return r.type === "remote-inbound-rtp" && r.ssrc === report.ssrc;
          });
          const previousRemoteInboundReport = Array.from(
            // @ts-expect-error RTCStatsReport types are busted
            previousStatsReport.values()
          ).find((r) => {
            // @ts-expect-error RTCStatsReport types are busted
            return r.type === "remote-inbound-rtp" && r.ssrc === previous.ssrc;
          });
          if (
            remoteInboundReport &&
            previousRemoteInboundReport &&
            packetsSent > 0
          ) {
            outboundPacketsSent += report.packetsSent - previous.packetsSent;
            outboundPacketsLost +=
              // @ts-expect-error RTCStatsReport types are busted
              remoteInboundReport.packetsLost -
              // @ts-expect-error RTCStatsReport types are busted
              previousRemoteInboundReport.packetsLost;
          }
        }
      });

      if (inboundPacketsReceived > 0) {
        const packetLossPercentage =
          inboundPacketsLost / (inboundPacketsReceived + inboundPacketsLost);
        inboundPacketLossPercentageEwma.insert(
          Math.max(0, packetLossPercentage)
        );
      }

      if (outboundPacketsSent > 0) {
        const packetLossPercentage =
          outboundPacketsLost / (outboundPacketsSent + outboundPacketsLost);
        outboundPacketLossPercentageEwma.insert(
          Math.max(0, packetLossPercentage)
        );
      }

      return {
        outboundPacketLossPercentage: outboundPacketLossPercentageEwma.value(),
        inboundPacketLossPercentage: inboundPacketLossPercentageEwma.value()
      } satisfies PacketLossStats;
    })
  );
}
