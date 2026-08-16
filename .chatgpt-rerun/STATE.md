# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — open/draft, not merged
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved completion history

Sequence 0 / Phase13 remains complete.

- implementation head `7c9440970753a370fec7830cfa691832552e1d05`
- exact-head success: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`
- Windows artifact `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`

Preserved narrow Phase14 evidence unless its source boundary changes:

- PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
- Host lifecycle `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
- saved non-reference Player Join / compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226` success.
- fresh non-fixture local production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422` success.

Do not rerun these focused gates merely because later lifecycle work is unfinished.

## Sequence 1 current work state

**Actual work branch/head:** `agent/108-production-play-session-ux` @ `c991ef2a28efe01b389f22141a9be6bb24f11862`.

**Current validated core regression-matrix head:** `c991ef2a28efe01b389f22141a9be6bb24f11862`.

Preflight for this continuation read `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, `PLAN.md` from `main` in the required order and reconciled run_id / sequence / task / `continue`. Initial actual state was `main=09f43044993c83a8d93f002b9130176d44f08f15`, work=`d64e5bf679f1cde139b21e86f158bd05e3780742`, PR #109 open/draft/unmerged.

### Structured spatial baseline repaired

The prior generalized spatial layer supported arbitrary Character ids but re-read mutable presentation distance for newly materialized pairs. A display mutation from 22 ft to 999 ft could therefore corrupt structured targeting state.

- `c9f103fee28c683129c1139b3d946cc3edf69604`: `realSpatialRuntimeService` now reuses an existing `scene-distance-baseline` relation as authoritative scene distance. Presentation distance seeds only when no structured baseline exists.
- `9aeb32a92c21b031156e2f221aacb8f24e39a2ec`: stale reference-fixture provenance assertion updated to the generalized baseline provenance.
- `fed72ebcb786bf952eb5286c475b724c57503806`: regression strengthened so 22 ft remains 22 after presentation changes to 999, and a late arbitrary Character receives the same stable 22 ft baseline.
- UI run `31969830496` at `fed72ebc...`: success including the Phase09 99-test mechanics batch and final TypeScript/production build.
- Phase11 `31969832891` at that source boundary: production walkthrough/frontend gate success.

No coordinates/pathfinding/LOS/tactical-map scope was added.

### Phase12 event-capture failure resolved as fixture-migration debt

The remaining connected failure was not a Host ledger or registry authority defect.

- Diagnostic head `795b8a3a203b5d608a2737d01da9eecfbe0e818f`, Phase12 run `31970028904`, added a prior assertion for `runtimeResolutionEventHistory`. It failed there: the historical fixture Shortbow never produced a committed runtime event batch under final Phase14 composition.
- Root cause: fixture Aelar exposes a historical `action.shortbow` attack but has no real Shortbow `ItemInstance`. Production action reconstruction cannot recover canonical weapon metadata for that fixture; localized fixture name `숏보우` falls through to a 5 ft legacy fallback, while Goblin A is 22 ft away. The authoritative transaction therefore correctly rejects before event commit.
- Product runtime was not weakened and no Aelar/fixture fallback was restored.
- Current head `c991ef2a28efe01b389f22141a9be6bb24f11862` migrated `connectedAttackEventCapture.test.ts` to a saved non-fixture Character with a real canonical Longbow `ItemInstance` (`dnd.srd521.item.weapon.longbow`). It starts production local play, asserts canonical 150 ft runtime range, commits the attack, and verifies runtime history plus connected publication registry use the same product resolution id with HP/economy events.

### Exact-head validation at `c991ef2a...`

Core matrix is green:

- UI push `31970228863`: success; Phase09 mechanics and final TypeScript/production build pass.
- PR UI `31970230351`: success.
- Contract validation `31970230345`: success.
- Phase11 `31970230344`: offline production walkthrough + full frontend gate success.
- Phase12 `31970230336`: 23/23 connected protocol/authority tests success; Phase11 preservation + production frontend gate success.
- Main Playable `31970230364`: Phase13 contract, Phase11 walkthrough, Phase12 authority, Phase13 projection lifecycle and frontend gate success.

Windows artifact sub-jobs triggered from Phase11/Phase12/Main are release/artifact work and were not used to establish the above core regression closure unless their final conclusions are separately fetched. Do not claim final Windows release acceptance from this checkpoint.

The regression debt that blocked Ready/start is now closed for the core exact-head matrix.

## Ready/start investigation completed, implementation not started

Checklist Ready/start boxes remain unchecked. No Ready/unready or Host start source change was made in this continuation.

Current architecture facts:

- `SessionParticipantVm` has participant identity and connection state but no readiness state.
- `productionSessionLifecycleAdapter` supports `offline | preparing | connecting | lobby | live`, Host/Join/stop, but no Ready intent or Host start command.
- `ProductionPlayerLobbyBridge` exposes saved Character selection/address/Join/lobby but no Ready control.
- `ProductionSessionLifecycleBridge` exposes Host preparation/address/stop but no participant readiness list, mode selector or Start gate.
- `ConnectedEventPayload.kind="participant"` exists and can carry authoritative participant state, but today only contains textual state/provenance.
- `connectedSessionWire` has no player Ready intent envelope.
- existing Host ledger/event-batch replication and `mode-transition` payload should be reused for convergence. Before implementing Host start, inspect `connectedTurnRoutingAdapter.ts`; do not invent a second mode synchronization path.

## Architecture boundaries preserved

Unchanged intentionally:

- Tauri transport implementation;
- connected wire protocol so far;
- Host ledger/shared-session authority;
- compatibility handshake;
- SessionProjection schema and Host reconstruction;
- reconnect/catch-up/event cursor semantics;
- ActionRequest -> ResolutionEvent routing;
- owning-client-only durable Character write-back;
- persistence formats;
- no tactical map/grid/token/path/LOS expansion.

## Known remaining risks / incomplete work

1. Ready/unready shared state, Host participant readiness display and Host start gating are not implemented.
2. Host-selected Freeform/Initiative start must converge through existing authoritative mode-transition/event-batch mechanics and must not become presentation-owned state.
3. Reconnect/late join must handle readiness safely; stale disconnected readiness must not silently carry authority.
4. `productionPlayRuntimeAdapter` can leave a stale previous local projection when switching between two non-fixture local Characters. Any repair must distinguish local-owned projection from remote ephemeral SessionProjection actors.
5. Explicit connected session end/restart and participant lifecycle acceptance remain incomplete.
6. Two-instance Windows human acceptance and final exact-head release artifact remain future gates.
7. PR #109 remains draft; no merge is authorized.

## Next Exact Action

Resume P14.8 Ready/unready + Host start gating on the current actual work head:

1. Read `src/app/connectedTurnRoutingAdapter.ts` first and reuse its Host-authoritative `mode-transition` flow for Freeform/Initiative start.
2. Extend `SessionParticipantVm` and `ConnectedEventPayload.kind="participant"` with explicit readiness.
3. Add a narrow player -> Host Ready/Undo Ready wire intent. Host validates session/peer/participant/compatibility, commits the participant event through `HostSessionLedger`, applies it locally and broadcasts it via existing event-batch.
4. Apply participant readiness events on clients so both sides converge. Reset/re-establish readiness safely on disconnect/reconnect/late join.
5. Add `setSessionReady(ready)` to the production/AppProvider boundary and visible Ready/취소 controls to `ProductionPlayerLobbyBridge` only in compatible lobby.
6. Add Host mode selection + `startPreparedSession(mode)`. Start is disabled/rejected until required connected player participants are compatible and ready; Host itself is not a player-readiness requirement. Return a clear visible reason for early start.
7. Show participant readiness, mode and Start in `ProductionSessionLifecycleBridge`; successful start moves both peers to the existing authoritative mode and lifecycle `live`.
8. Add focused wire/runtime/lifecycle/UI tests, run Phase12 first, then UI/TypeScript, then Main Playable. Only then credit Ready/start checklist boxes.

## Dispatch recommendation

`continue`
