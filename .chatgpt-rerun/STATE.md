# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch transition: `continue` prepared; publish `control.json` last
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved completion history

Sequence 0 / `phase13-closeout-ui-dice-regression` remains complete and is not reset by Phase 14.

Preserved verified implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved exact-head workflow evidence:

- Contract validation `31955742556` — success
- Rules Domain `31955742577` — success
- Persistence `31955742563` — success
- UI `31955742530` — success
- Phase 11 Playable `31955742560` — success
- Phase 12 Connected Session `31955742539` — success
- Phase 13 SessionProjection `31955742524` — success

Preserved Phase 13 artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

The later Main Playable workflow at `0ebc8b7a020b4ec64c2678b398aa5c064de46a93` produced a green Windows artifact, but manual product inspection established that those gates did not prove user-created Character -> actual session/play UI. Phase 14 exists specifically to correct that gap.

## Sequence 1 durable checkpoint

The user has now reviewed the Phase 14 completion scope and explicitly authorized Rerun to resume from the checklist checkpoint. This is the same run_id / sequence 1 / task; no prior validation history is reset.

The release scope explicitly includes the complete connected-session lifecycle in addition to the in-session mechanics:

1. DM starts/stops the actual Host/server from visible UI, sees listen/address/port state, and gets actionable bind/network errors.
2. DM has a preparation/lobby flow for rules/content status, Scene/Combatants, participant visibility, and readiness before starting play.
3. Player selects their persisted Character, enters the Host address, completes transport + compatibility handshake, and reaches the lobby without debug controls.
4. Host-unknown player Character is reconstructed as an ephemeral host-authoritative SessionProjection while permanent Character ownership remains with the player.
5. Ready/start transitions the prepared participant set into actual Freeform or Initiative play.
6. Actions, Skills, Spells, Inventory, targeting, Combatants, DM corrections, reactions, conditions/concentration, Activity/Undo, and authoritative dice share the same session state.
7. Late join, disconnect/reconnect, duplicate/replayed requests/events, incompatibility, and invalid projection have explicit safe behavior.
8. Session end clears transient/projection state while preserving only owning-player durable Character changes.
9. Final Windows acceptance covers DM app launch -> Host start -> DM preparation -> Player launch -> Character selection -> Join -> Ready/start -> play -> disconnect/reconnect -> session end/restart.

## Production root cause to preserve during implementation

1. `AppProvider` delegates the visible UI command surface through a singleton `MockAdapter`.
2. The base adapter is seeded with Aelar/Mira/reference Combatants and fixed action identities.
3. Character authoring/persistence can replace `activeCharacter`, but the historical normal play path did not prove that a new Character is materialized into Scene + actions.
4. Persistence previously projected HP/AC only into an already-existing matching Scene entity.
5. Player Scene assumed an actor exists in `scene.entities`.
6. Existing Phase 11 walkthroughs primarily used reference ids, so green tests were insufficient evidence of the real user journey.
7. Tauri Host/Join, handshake, reconnect, SessionProjection, authoritative ActionRequest/ResolutionEvent routing, and owning-client write-back are real subsystems to preserve.

## Current work branch state

Last recorded work branch head:

`01cb784f1c64d46c931175126dde6abadc744907`

The branch contains early **unverified** Phase 14 implementation:

- `src/app/productionPlayRuntimeAdapter.ts`
- `src/app/productionDiceRuntimeAdapter.ts`
- `src/PlaySessionDock.tsx`
- outer composition imports in `src/app/offlineRuntimeAdapters.ts`
- `.agents/PHASE14_CHECKLIST.md`

Do not award completion credit from source presence. Validate behavior at concrete commits.

## Rerun connectivity

Chrome Side Panel remains connected to:

- Owner: `Kaetaeru`
- Repository: `SimpleVTT`
- Branch: `main`
- Control: `.chatgpt-rerun/control.json`

The watcher reads coordination from `main`; implementation occurs on the active work branch recorded above. `continue` on the same sequence means resume from this checkpoint.

## Next Exact Action

After `control.json` is published last with the same run_id, sequence `1`, task_id, and `status: continue`:

1. Read README -> control -> STATE -> PLAN and re-fetch current `main` plus `agent/108-production-play-session-ux` before writing.
2. Fetch `.agents/PHASE14_CHECKLIST.md`; reconcile its broad Host/Join and DM sections with the newly explicit server startup -> DM preparation/lobby -> player Character selection/join -> Ready/start -> participant lifecycle -> session shutdown release requirements. Do not remove existing gates.
3. Validate the already-present work-branch changes **before adding more product code**: inspect the diff, run/trigger TypeScript + production UI/build gates and the smallest relevant product-realistic tests, and identify compile/runtime failures.
4. Fix validation failures first. Then continue from checklist P14.1 Character -> live Scene/action materialization, followed by visible play entry and session lifecycle UX.
5. Preserve Phase 09-13 authoritative rules/network/write-back boundaries; do not replace proven transport or SessionProjection authority with UI-owned state.
6. Record only evidence-backed checklist completion. Do not repeat old validation unless a Phase 14 change touches that boundary.
7. Maintain STATUS on meaningful milestones and write a durable checkpoint before the Rerun hard stop.
