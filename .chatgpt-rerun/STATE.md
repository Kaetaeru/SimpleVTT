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

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` success and Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Preserved Phase14 focused evidence unless source boundary changes:

- PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635`.
- Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715`.
- saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226`.
- fresh non-fixture production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422`.
- repaired pre-Ready core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862`: UI `31970228863`/`31970230351`, Contract `31970230345`, Phase11 `31970230344`, Phase12 `31970230336`, Main `31970230364` success.

## Current work state

**Actual work branch/head before coordination writes:** `agent/108-production-play-session-ux` @ `04ceba160ac84052866f5b7fc91e4c69ab1db527`.

Preflight for this continuation read `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, `PLAN.md` from `main` in the required order and reconciled run_id / sequence / task / `continue`. Initial actual state was `main=59224c9717b752e5c5631721839b2fe584f97670`, work=`c991ef2a28efe01b389f22141a9be6bb24f11862`, PR #109 open/draft/unmerged.

## Ready/unready + Host start implementation

The existing `connectedTurnRoutingAdapter.ts` Host-led `mode-transition` event-batch path was reused; no duplicate mode authority channel was introduced.

Implemented:

1. Structured authoritative participant events include identity, connected/reconnecting/disconnected state and explicit Ready state.
2. New `ready-intent` wire message carries only session id + boolean; participant identity is derived from the transport peer. Malformed readiness is rejected by wire validation.
3. Connected runtime tracks peer->participant binding and `sessionStarted`. `ready-intent-v1` is a required connected capability.
4. Accepted hello/reconnect emits Host-authoritative participant state with Ready reset. Host validates Ready against session, connected participant, accepted peer manifest and compatibility, commits it through `HostSessionLedger`, applies locally and broadcasts via normal event-batch. Clients apply participant events to the shared participant list.
5. Production lifecycle exposes `setSessionReady(ready)` for compatible Player lobby and `startPreparedSession(mode)` for Host. Start requires at least one player; every player must be connected, Ready and bound to an accepted compatible peer. Host itself is not a player-readiness requirement.
6. Initiative start calls the existing Host-authoritative `startInitiative()` projection. Freeform start uses the same exported mode-transition projection helper after setting Freeform.
7. AppProvider exposes Ready/start. Player production lobby visibly shows Ready / Ready 취소 after compatible lobby entry. Host production surface shows participant readiness, Freeform/Initiative selection, gated Start and live mode.
8. Focused tests cover Ready wire roundtrip/validation, player Ready intent, transport-peer-bound Host Ready confirmation, Start rejection before Ready, Initiative live transition after Ready, and visible UI structure. Phase12 canonical gate now includes the production lifecycle test.

Implementation commits in this slice:

- `b4d1d77e795db66afba1f28e000d17bf83706bdc`
- `99a5e01583c9d28530529bf30fc33527efce0cee`
- `ae5cbd63932ef1ecc85db0d91bcdce10a75b539e`
- `64f426f092e2de4678bf1b9ebafd48478b61ff5d`
- `c3d6d1b5057be5309c763fab01d3983d2ff44fa1`
- `1b88cfae5d3c8f3d1fe00dbc5b7420efc97493a7`
- `98f1820f4ee9699c121ecd3f3acba6cc8e048f64`
- `1177ac2c02aac33e170eb6e02e0a1054a1abf66c`
- `263ad566a37caee4af1f6db877f2261662fba063`
- `83646e0071209859202a3eff6606458ee46df55a`
- `5c7c1e271c4944ca8252a6cbc149c0fdc9a4ece0`
- `a208f87f2e95838c3d011ac9e3420605d254c980`

## Exact validation

At `a208f87f2e95838c3d011ac9e3420605d254c980`:

- Phase12 run `31970977017`, connected-protocol job `95223275319`: success. Ready/start authority tests passed; Phase11 preservation passed; production frontend build passed.
- UI run `31970977035`, job `95223275314`: all load-bearing steps passed including Phase14 Host lifecycle, Phase09 mechanics, TypeScript and production build. Last fetch showed only post-action cleanup still finishing.
- Main Playable `31970977130`: full UI/build, Phase11 and Phase12 steps passed; only Phase13 arbitrary Character SessionProjection failed.

The Main failure was traced to test capability drift. `connectedProjectedCharacterResolution.test.ts` manually sent the old capability list, so current product routing correctly rejected the projected ActionRequest because `ready-intent-v1` is now required. This was not a SessionProjection product regression.

`04ceba160ac84052866f5b7fc91e4c69ab1db527` updates the Phase13 projected-resolution fixture to use exported `CONNECTED_CAPABILITIES` in both its manifest and ActionRequest. New exact-head Main run `31971251262` exists and was queued when this checkpoint was written. Do not claim Main green until this run is fetched.

## Checklist status

Do **not** mark P14.8 Ready/start complete yet.

The core Ready authority/UI path is implemented and Phase12/UI evidence is green at the immediately preceding product source boundary, but two items remain before checklist credit:

1. exact-head Main `31971251262` at `04ceba...` must pass after the capability fixture migration;
2. stale readiness on Host-side peer disconnect needs an explicit safe rule/regression. The transport exposes aggregate peer count rather than the lost peer id, so Host Start must not be able to rely on a prior Ready after peer loss. A conservative all-player Ready reset/disconnected state on Host peer-count drop is acceptable if exact peer identity is unavailable, followed by re-handshake/re-Ready.

A focused production Freeform start regression is also desirable because the new lifecycle test directly exercises Initiative start; historical connected turn tests cover Freeform mode-transition machinery but not `startPreparedSession("freeform")` itself.

## Architecture boundaries preserved

- Host ledger/shared-session authority preserved.
- compatibility handshake + SessionProjection preserved.
- event cursor/catch-up and ResolutionEvent routing preserved.
- owning-client durable Character write-back preserved.
- no tactical map/grid/path/LOS scope added.
- no fixture Character fallback added to production play.

## Known remaining work

1. Fetch exact-head Main `31971251262` at `04ceba...` and resolve only a real remaining failure if any.
2. Add Host peer-loss stale-Ready reset/re-handshake safety and regression.
3. Add focused Freeform prepared-start regression if still uncovered, then credit only the Ready/start checklist boxes proved by exact-head evidence.
4. Continue late join/disconnect/reconnect participant lifecycle and explicit session end/restart.
5. Repair known stale previous local projection when switching two non-fixture local Characters without removing remote ephemeral SessionProjection actors.
6. Run two-instance Windows human acceptance/final release artifact later; no Windows completion is claimed here.
7. PR #109 remains draft and unmerged; no merge is authorized.

## Next Exact Action

1. Fetch Main Playable `31971251262` for `04ceba160ac84052866f5b7fc91e4c69ab1db527`.
2. If green, implement the narrow Host peer-count drop -> participant disconnected/Ready reset safety contract plus regression; if red, inspect only the new failing step first.
3. Add/verify Freeform prepared start and rerun the smallest Phase12 authority gate, UI/TypeScript, then Main as relevant.
4. Only after those gates are green update `.agents/PHASE14_CHECKLIST.md` for Ready/start.

## Dispatch recommendation

`continue`
