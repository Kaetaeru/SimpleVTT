# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
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

The user has reviewed the Phase 14 completion scope and explicitly authorized Rerun to resume from the checklist checkpoint. This is the same run_id / sequence 1 / task; no prior validation history is reset.

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

Current work branch head:

`eaac9d7de499433f8f6da8e04f16100326facd57`

Checklist focus: P14.2 session workspace and P14.11 UI structure/behavior, before broader P14.7/P14.8 lifecycle UX.

### Completed since previous checkpoint

A narrow source repair was committed in `src/PlaySessionDock.tsx`:

- removed conditionally reached `useMemo` after the `snapshot === null` early return, eliminating the identified React hook-order runtime risk during hydration;
- tab switching no longer clears `pendingActionId`, preserving pending target/action legal context across the four play tabs as required by P14.2.

This is **not** evidence-backed feature completion yet.

### Validation evidence

- Previous UI/build workflow evidence was inspected and showed the pre-existing Phase 14 source had compiled successfully.
- That evidence predates `eaac9d7de499433f8f6da8e04f16100326facd57` and therefore does not validate the new source head.
- No exact-head post-change regression test or UI/TypeScript production gate has run for `eaac9d7...` yet.
- No Phase 14 checklist checkbox was newly marked complete in this execution.

### Known failures / risks

1. The PlaySessionDock hydration/tab-context repair still needs an exact-head regression proving runtime behavior, not just source inspection.
2. The Phase 14 checklist has broad Host/Join gates, while the release requirement explicitly includes server startup -> DM preparation/lobby -> player Character selection/join -> Ready/start -> participant lifecycle -> session shutdown. That lifecycle decomposition still needs to be added without removing existing gates.
3. Production visible Host/Join/lobby/readiness/end-session UX is not yet established. Existing Tauri transport, SessionProjection, host authority, reconnect/catch-up, and owning-client write-back must be reused rather than replaced.
4. Product-realistic fresh-Character/local/connected gates remain unverified.

### Files / architecture boundaries changed

- `src/PlaySessionDock.tsx` only in this execution slice.
- No rules, persistence, Tauri transport, SessionProjection, host-authority, or durable write-back boundary was changed.

## Rerun connectivity

Chrome Side Panel remains connected to:

- Owner: `Kaetaeru`
- Repository: `SimpleVTT`
- Branch: `main`
- Control: `.chatgpt-rerun/control.json`

The watcher reads coordination from `main`; implementation occurs on the active work branch recorded above. `continue` on the same sequence means resume from this checkpoint.

## Next Exact Action

At work head `eaac9d7de499433f8f6da8e04f16100326facd57`, add the smallest focused Phase 14 UI regression proving PlaySessionDock can transition from `snapshot=null` to hydrated state without a hook-order failure and that pending target/action context survives tab switches; then run the exact-head UI/TypeScript production gate before awarding checklist credit or adding broader Host/Join lifecycle UI.

## Dispatch recommendation

`continue`
