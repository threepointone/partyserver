---
"@partyserver/fixture-partytracks": patch
"partytracks": patch
---

- Add getMic, getCamera, and createAudioSink utils.
- Lock sessions to their initiator via a cookie w/ JWT.
- Fixed a bug where toggling a device off and on rapidly could leave it in a "stuck on" state.
