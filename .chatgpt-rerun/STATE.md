# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch transition: `continue` prepared; publish `control.json` last
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `main`
- planned work branch: `agent/108-production-play-session-ux`
- tracking issue: #108

## Preserved completion history

Sequence 0 / `phase13-closeout-ui-dice-regression` completed successfully and is not reset by this authorization.

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

The later canonical Main Playable workflow was updated on `main` at `0ebc8b7a020b4ec64c2678b398aa5c064de46a93` and produced a green Windows artifact, but subsequent manual product inspection established that those gates did not prove the user-created Character -> actual session/play UI path.

## Sequence 1 durable checkpoint

The user explicitly authorized a new phase whose goal is planning through playable Windows build completion. The user specifically requested that play-session UX include in-session inventory/item use and comprehensive skill/action tabs.

Repository inspection established the concrete production gap:

1. `src/main.tsx` loads the production adapter composition and connected adapters, but the React application still enters through `AppProvider`.
2. `AppProvider` delegates the full UI command surface to a singleton `mockAdapter`.
3. `mockAdapter.ts` seeds Aelar, Mira, goblins, a wolf, a `Reference Mock` guardian, and fixed `actionsByActor` entries.
4. Character authoring can replace `activeCharacter`, but its finalization path does not build a corresponding live Scene actor/action projection.
5. Character persistence projects HP/AC into an existing scene entity only when one with the same Character id already exists; otherwise it returns without materializing the Character.
6. `PlayerSceneScreen` assumes the active Character can be found in `scene.entities`, so a genuinely new Character is not a proven safe production play path.
7. Existing Phase 11 production-walkthrough tests instantiate `MockAdapter` and directly exercise reference action IDs such as `action.athletics`, `action.healing-potion`, and reference Character IDs; they therefore validate rules/runtime composition but not the real user journey.
8. Tauri Host/Join, handshake, reconnect, SessionProjection, authoritative ActionRequest/ResolutionEvent routing, and owning-client write-back are real subsystems and should be preserved rather than replaced.

Issue #108 now defines Phase 14 product/UX/acceptance requirements.

## Active implementation strategy

The implementation should introduce a production Character-to-play projection boundary rather than rewriting the proven rules engine. The work should progressively replace normal-player reliance on reference identities while retaining explicit fixtures for tests/debug only.

Priority order:

1. Materialize/reconcile the actual active persisted Character into Scene state and derived actions.
2. Make no-session/no-actor UI deliberate and provide a clear Character Sheet -> Play path.
3. Add in-session `행동 / 기술 / 주문 / 인벤토리` surfaces with stable targeting/turn/session context.
4. Derive authoritative skill checks and real Character attacks/features/items/spells.
5. Reuse existing item/equipment/attunement/use and authoritative resolution ports from the play workspace.
6. Reconcile local session and connected Host/Join onto the same production actor projection.
7. Add fresh-Character and restart production journey gates that do not rely on Aelar/Mira fixture ids.
8. Build and verify an exact-head Windows playable artifact.

## Risks to watch

- Existing runtime adapters often wrap `MockAdapter.prototype`; changing the base composition carelessly can reorder or bypass authoritative Phase 09-13 behavior.
- Scene/action derivation must not duplicate mechanics calculations that already have canonical rule/catalog implementations.
- Connected SessionProjection authority must stay host-reconstructed; a richer UI must not promote client presentation fields to authority.
- Inventory UX must distinguish immediate equipment/attunement state changes from item actions that require staged authoritative ResolutionEvents.
- Freeform skills should not consume Initiative action economy; Initiative-only actions must still enforce economy.

## Next Exact Action

After final `control.json` publication with sequence `1`, task `phase14-production-play-session-ux`, status `continue`:

1. Re-fetch current `main` and create `agent/108-production-play-session-ux` from that exact head.
2. Create a Phase 14 checklist on the work branch.
3. Implement the Character -> Scene/action materialization boundary and a regression test using a newly authored non-fixture Character id.
4. Wire the Character Sheet/Library play entry and deliberate empty/setup state.
5. Add session console tabs starting with Actions/Skills, then Inventory/Spells.
6. Run GitHub Actions after coherent slices; fix failures before proceeding.
7. Keep Rerun STATUS fresh on meaningful milestones and checkpoint by the protocol hard stop if the sequence cannot complete in one execution.
