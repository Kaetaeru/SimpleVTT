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

## Preserved completion

Phase 13 remains complete and must not be reset merely because Phase 14 is unfinished.

- Preserved implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.
- Preserved exact-head successes: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable narrow Phase14 evidence unless its source changes:

- PlaySessionDock: `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
- Host start/stop/restart/preparation: `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
- Saved non-reference Character selection / Join / compatible lobby: `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233` and Persistence `31967968226` success.
- Fresh non-fixture local production play: `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422` success for create/save/restart, derived skill, canonical ranged attack, Initiative economy/Undo, DM correction and frontend gate.

Do not repeat these focused gates unless a later source edit touches the relevant boundary.

## Phase 14 product and authority constraints

SimpleVTT must be playable through visible production UI with user-created/persisted Characters. The normal path must not depend on Aelar/Mira/fixed goblin ids, Ctrl+Shift+D or reference scenario loading. Reference fixtures remain only for explicit subsystem tests/debug.

Reuse the existing Tauri transport, connected runtime, Host ledger, compatibility handshake, SessionProjection, reconnect/catch-up, ActionRequest/ResolutionEvent routing and owning-client durable write-back. Shared session state remains Host-authoritative; permanent Character ownership remains with the owning player. Do not add tactical map/grid/path/LOS scope.

## Regression repair completed in this continuation

Current validated work head: `c991ef2a28efe01b389f22141a9be6bb24f11862`.

### Stable structured spatial baseline

The generalized theater-of-mind spatial layer previously re-read mutable presentation `entity.distance`, so a test changing display text from 22 ft to 999 ft overwrote runtime targeting state.

- `c9f103fee28c683129c1139b3d946cc3edf69604` changed `realSpatialRuntimeService` so presentation distance may seed a scene baseline only when no structured baseline exists; existing `scene-distance-baseline` relations are authoritative thereafter and are reused for newly materialized Character actors.
- `9aeb32a92c21b031156e2f221aacb8f24e39a2ec` aligned stale provenance expectations with the generalized baseline.
- `fed72ebcb786bf952eb5286c475b724c57503806` strengthened the atomic attack regression: seed 22 ft, mutate presentation to 999 ft, verify the existing pair stays 22 ft and a late arbitrary Character also receives 22 ft from the stable structured baseline.
- UI run `31969830496` at `fed72ebc...` succeeded, including the Phase09 99-test mechanics batch and final TypeScript/production build.
- Phase11 run `31969832891` at the same source boundary succeeded for the production offline walkthrough/frontend gate.

This spatial regression is closed. Do not revert to mutable presentation strings or hard-coded reference actor pairs.

### Phase12 committed-event capture fixture migration

Phase12 remained 22/23 because the old focused test attempted fixture Aelar `action.shortbow` under the final Phase14 production composition.

- Diagnostic head `795b8a3a203b5d608a2737d01da9eecfbe0e818f`, Phase12 run `31970028904`, proved the failure occurred before connected publication: no runtime event history existed after the fixture attack.
- Root cause: fixture Aelar exposes a historical Shortbow attack but does not own a real Shortbow `ItemInstance`. Final production action reconstruction therefore cannot recover canonical weapon metadata for that fixture; the localized fixture name `숏보우` falls through to a 5 ft legacy fallback, so the 22 ft target is correctly rejected and no committed event batch exists.
- The product path was not weakened and no fixture fallback was restored.
- `c991ef2a28efe01b389f22141a9be6bb24f11862` migrated `connectedAttackEventCapture.test.ts` to a saved non-fixture Character with an actual canonical Longbow `ItemInstance` (`dnd.srd521.item.weapon.longbow`). The test enters production local play, materializes 150 ft runtime range, commits the attack and verifies runtime history plus the connected publication registry share the product resolution id and contain HP/economy events.

### Exact-head regression matrix at `c991ef2a...`

Core Linux/contract gates are green:

- UI push `31970228863`: success including Phase09 mechanics and final TypeScript/production build.
- PR UI `31970230351`: success.
- Contract validation `31970230345`: success.
- Phase11 `31970230344`: offline production walkthrough and full frontend gate success.
- Phase12 `31970230336`: all 23 connected authority/protocol tests success; its Phase11 preservation and production frontend gate also success.
- Main Playable `31970230364`: Phase13 contract, Phase11, Phase12 connected authority, Phase13 projection lifecycle and frontend gate success.

Windows artifact sub-jobs triggered by these workflows were still separate release/artifact work and are not used as completion evidence here unless their final conclusions are explicitly fetched. The regression debt that blocked Ready/start is closed for the core matrix.

## Ready/start boundary discovered

No Ready/start source change has been made yet. The existing model currently has:

- `SessionParticipantVm` with identity/connection state but no readiness field.
- `productionSessionLifecycleAdapter` lifecycle `offline | preparing | connecting | lobby | live`, but no Ready intent or Host start command.
- `ProductionPlayerLobbyBridge` with Character selection/Join/lobby state but no Ready control.
- `ProductionSessionLifecycleBridge` with Host preparation/shareable address/stop but no participant readiness list, mode selection or Start gate.
- `ConnectedEventPayload.kind="participant"` exists but currently carries only textual state/provenance; it can be extended as the Host-authoritative participant-state event rather than adding a second synchronization channel.
- `connectedSessionWire` has no client Ready intent message yet.
- Existing event-batch application and `mode-transition` payload already provide the right Host-led convergence pattern for session state. Inspect and reuse `connectedTurnRoutingAdapter.ts` before adding any new start/mode publication path.

## Next Exact Action

Resume P14.8 Ready/unready + Host start gating, preserving the now-green matrix:

1. Read `connectedTurnRoutingAdapter.ts` first and identify the existing Host-authoritative Freeform/Initiative `mode-transition` publication path. Reuse it rather than implementing duplicate mode synchronization.
2. Add readiness as explicit shared participant state, not a UI-local boolean. Extend `SessionParticipantVm` and structured `ConnectedEventPayload.kind="participant"` with readiness while keeping connection lifecycle explicit.
3. Add one narrow client -> Host Ready intent envelope to `connectedSessionWire`. Host must bind the intent to the transport peer/known participant and reject wrong session, incompatible/disconnected/spoofed participant state. Host commits the accepted change through `HostSessionLedger` and broadcasts it through the existing authoritative event-batch path.
4. Apply Host participant events on both Host and clients so Ready and Undo Ready converge to the same participant list. Reconnect/late-join semantics must reset or explicitly re-establish readiness safely; do not silently trust stale readiness from disconnected peers.
5. Expose `setSessionReady(ready)` on the production/AppProvider boundary. In `ProductionPlayerLobbyBridge`, show visible Ready / Ready 취소 only after compatible lobby entry.
6. Expose Host mode selection (`freeform` / `initiative`) and `startPreparedSession(mode)` through the production lifecycle boundary. Host Start is disabled/rejected until all required connected player participants are compatible and ready; Host itself is not a player-readiness requirement. Early start must return a clear visible reason.
7. In `ProductionSessionLifecycleBridge`, show participants and readiness, mode selection and Start. Successful Host start must transition both peers through the existing Host-authoritative mode event and set lifecycle `live` without presentation-owned authority.
8. Add focused wire/runtime/lifecycle/UI regressions for Ready, Undo Ready, spoof/reject, Host gating and both-client mode convergence. Run Phase12 first for authority semantics, UI for visible controls/TypeScript, then Main Playable. Do not credit checklist Ready/start boxes until these exact-head gates pass.
9. After Ready/start is green, continue participant disconnect/reconnect/late-join lifecycle, explicit session end/restart, active-local-Character projection cleanup and the Windows two-instance release walkthrough.

Known future risk: `productionPlayRuntimeAdapter` can leave a stale previous local projection when switching between two non-fixture local Characters. Any repair must remove only the prior local-owned projection and preserve remote ephemeral SessionProjection actors.

Draft PR #109 remains open/draft. No merge is authorized or attempted.
