# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch transition: `needs_user` prepared; publish `control.json` last
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

The user authorized planning through actual playable Windows build completion, with special emphasis on in-session Inventory/item use plus comprehensive Skills/Actions UX.

The production root cause remains:

1. `AppProvider` delegates the visible UI command surface through a singleton `MockAdapter`.
2. The base adapter is seeded with Aelar/Mira/reference Combatants and fixed action identities.
3. Character authoring/persistence can replace `activeCharacter`, but the historical normal play path did not prove that a new Character is materialized into Scene + actions.
4. Persistence previously projected HP/AC only into an already-existing matching Scene entity.
5. Player Scene assumed an actor exists in `scene.entities`.
6. Existing Phase 11 walkthroughs primarily used reference ids, so green tests were insufficient evidence of the real user journey.
7. Tauri Host/Join, handshake, reconnect, SessionProjection, authoritative ActionRequest/ResolutionEvent routing, and owning-client write-back are real subsystems to preserve.

## Current work branch state

Current work branch head after checklist expansion:

`01cb784f1c64d46c931175126dde6abadc744907`

The branch is based on the Phase 14-authorized `main` baseline and already contains early unverified implementation from the interrupted prior execution:

- `src/app/productionPlayRuntimeAdapter.ts`
- `src/app/productionDiceRuntimeAdapter.ts`
- `src/PlaySessionDock.tsx`
- outer composition imports in `src/app/offlineRuntimeAdapters.ts`
- `.agents/PHASE14_CHECKLIST.md`

These files are **not treated as completed product behavior yet**. They require compilation, product-realistic integration tests, UI verification, connected regressions, and human acceptance as defined by the checklist.

## Final completion checklist created

`.agents/PHASE14_CHECKLIST.md` was expanded at work-branch head `01cb784f1c64d46c931175126dde6abadc744907` into the release-blocking execution contract for Phase 14.

It covers:

- Rerun Side Panel/main coordination and mandatory dispatch protocol
- Character -> Scene/action materialization
- Play entry/session information architecture
- authoritative Skills rolls
- Actions/attacks/features
- in-session Inventory/equipment/attunement/item use
- real Character spellcasting
- local player + DM live-session flow
- connected Host/Join with host-unknown Character
- persistence/restart/data ownership
- viewport/keyboard/reduced-motion UX quality
- fresh non-fixture Character integration gates
- Phase 11/12/13 and rules/persistence/UI/Tauri regression matrix
- required local and two-instance connected human Windows walkthroughs
- exact-head Windows artifact metadata and SHA-256 validation
- merge/main validation and final Rerun closeout

The checklist explicitly forbids claiming “모든 기능을 담은 플레이 가능한 버전” before both automated and human acceptance gates pass.

## Rerun connectivity decision

Chrome Side Panel remains connected to:

- Owner: `Kaetaeru`
- Repository: `SimpleVTT`
- Branch: `main`
- Control: `.chatgpt-rerun/control.json`

The watcher reads coordination from `main`; implementation occurs on the work branch named above. This prevents dispatch/control drift while allowing isolated feature development.

The latest user instruction asks to establish the checklist first. Therefore this checkpoint intentionally pauses further implementation for checklist review instead of allowing the watcher to continue automatically.

## Next Exact Action

After `control.json` is published last with the same run_id, sequence `1`, task_id, and `status: needs_user`:

1. Do not make further Phase 14 source changes until the user approves/resumes the checklist.
2. Keep Side Panel watcher running if desired; `needs_user` is a polling/waiting state, not Stop.
3. On user approval, change the same sequence 1 back to `continue` using PLAN -> STATE -> control order.
4. The first implementation action after reauthorization is **validate the already-present work-branch changes before adding more code**: inspect the current diff, run/trigger TypeScript + relevant UI/integration gates, identify any compile/runtime breakage, and only then continue from checklist P14.1.
5. Do not repeat Phase 13 validations unless a Phase 14 change touches the boundary they cover.
