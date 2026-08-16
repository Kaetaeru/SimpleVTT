# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved completion and reusable evidence

Phase 13 remains complete and is not reset by unfinished Phase 14 work.

- Phase13 implementation head `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` success.
- Preserved Windows artifact `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.
- Reusable Phase14 evidence unless its source boundary changes:
  - PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
  - Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
  - saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226` success.
  - fresh non-fixture local production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422` success.
  - repaired pre-Ready core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862`: UI `31970228863`/`31970230351`, Contract `31970230345`, Phase11 `31970230344`, Phase12 `31970230336`, Main `31970230364` success.

Do not repeat focused gates unless the relevant source boundary changes.

## Phase 14 authority constraints

Normal product play must use user-created/persisted Characters and visible production UI, not Aelar/Mira/fixed goblin ids/reference shortcuts. Reuse Tauri transport, Host ledger, compatibility handshake, SessionProjection, event cursor/catch-up, ActionRequest/ResolutionEvent and owning-client durable write-back. Shared session state remains Host-authoritative; permanent Character ownership remains with the owning player. Do not add tactical map/grid/path/LOS scope.

## Ready/start slice — completed and credited

Current work branch head after checklist credit: `56ef07b85e805368b1a9a61863c68683c3409208`.
Current validated product source boundary: `bd1077b9bc61b86c2c0370543a16496c72f840c2`.

The Ready/start implementation reuses the existing Host-authoritative `mode-transition` and event-batch paths. The previously implemented structured participant Ready state, peer-bound `ready-intent`, AppProvider/UI controls, readiness-gated Host start and Initiative path remain intact.

This continuation closed the two remaining Ready/start safety gaps:

1. `c6d766ef452d31223617978f5421c8ed6563b3ec` adds a production lifecycle Host `peerCount` observer. Because the transport status exposes aggregate peer count rather than the disconnected peer identity, a pre-start peer-count decrease conservatively resets every currently Ready player to `ready:false` through Host-led `participant` ledger events and broadcasts the normal event-batch. Peer/manifest bindings are retained so remaining connected peers can re-Ready; a missing peer cannot re-Ready and therefore still blocks Host Start until it reconnects/re-handshakes.
2. `2564bca3904072d552ef470257ca05fc92e9f794` adds `productionReadyStartSafety.test.ts`, proving `peerCount 1 -> 0` resets stale Ready and re-blocks Start, and directly proving `startPreparedSession("freeform")` publishes a Host-authoritative Freeform mode event.
3. `bd1077b9bc61b86c2c0370543a16496c72f840c2` adds the safety test to the canonical Phase12 connected authority gate.
4. `56ef07b85e805368b1a9a61863c68683c3409208` marks only the six P14.8 `Ready and start lifecycle` checklist items complete and records the exact evidence. This commit changes checklist documentation only; it does not change the validated product source boundary.

### Exact validation for `bd1077b9...`

- Phase12 `31971618571`: `Verify connected-session authority protocol` success including the new peer-loss and Freeform focused regression; Phase11 preservation success; production frontend gate success.
- UI `31971618534`: production Host lifecycle focused gate, Phase09 mechanics, TypeScript and production build all success; frontend job completed success.
- Phase11 `31971618537`: production-composed offline walkthrough and full production frontend gate success.
- Main Playable `31971618703`: playable-contract completed success; full UI/rules/TypeScript/build, Phase11, Phase12 connected authority and Phase13 arbitrary Character SessionProjection all success.
- Earlier exact-head Main `31971251262` at `04ceba160ac84052866f5b7fc91e4c69ab1db527` also completed playable-contract success after the projected-resolution capability fixture was aligned to `CONNECTED_CAPABILITIES`.

Windows sub-jobs/artifacts are not used as human acceptance or final release evidence here.

## Ready/start checklist credit

The six P14.8 Ready/start items are now evidence-backed at `bd1077b9...` and checked in `.agents/PHASE14_CHECKLIST.md` at `56ef07b8...`:

- Player can mark Ready/unready in lobby.
- Host sees per-participant readiness.
- Host rejects Start when readiness/preparation conditions are unmet.
- Host can start prepared Freeform.
- Host can start prepared Initiative with authoritative turn state.
- Clients converge through Host `mode-transition` events rather than presentation-owned mutation.

Do not reopen these boxes unless later source changes their authority/lifecycle boundary.

## Next Exact Action — participant lifecycle

Resume P14.8 `Participant lifecycle`; do not return to Ready/start first.

1. Inspect the Tauri connected-session backend and frontend transport event contract to determine whether peer disconnect identity is already available below `SessionTransportStatus`. The current frontend status contract exposes only aggregate `peerCount`.
2. If the backend already knows the departing peer id, expose the smallest typed peer-lifecycle event through `tauriSessionTransport`; otherwise add the narrowest backend event needed. Do not infer a peer id from aggregate counts.
3. On Host, commit an authoritative `participant` event for the exact departing participant with `state:"disconnected"` and `ready:false`, while preserving the host-authoritative SessionProjection/runtime state required for reconnect. Do not delete permanent Character data or discard the reconnectable projection merely because transport dropped.
4. Define late-join policy explicitly: preparation-lobby joins may be accepted; after `sessionStarted`, a genuinely new participant must be rejected or deferred without mutating live turn/session state. A reconnect of a previously accepted participant remains allowed and must resume from the accepted event cursor.
5. On reconnect, rebind peer -> participant/Character safely, preserve authoritative runtime over stale client projection, emit connected participant state, and require Ready again only when still in preparation. Keep duplicate/replayed hello/action/event behavior idempotent.
6. Add the smallest Rust/transport + Phase12 frontend regressions for exact disconnect participant state, live late-join rejection, and reconnect restoration. Run only the source-relevant Tauri tests plus Phase12 first; then UI/Main if the production boundary changes.
7. After participant lifecycle is green, continue explicit live session end notification/cleanup, clean Host restart, then the known local-active-Character stale projection cleanup.

Known separate risk: switching two non-fixture local Characters can leave a stale previous local projection in `productionPlayRuntimeAdapter`; any fix must remove only the prior local-owned projection and preserve remote ephemeral SessionProjection actors.

Draft PR #109 remains open/draft. No merge is authorized or attempted.
