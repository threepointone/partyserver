---
"partytracks": patch
---

Bug fix: Stop transceiver right before renegotiating. This avoids a potential undesirable outcome where
a transceiver could be released and _potentially_ re-used in a subsequent negotiation before the track
is actually closed.
