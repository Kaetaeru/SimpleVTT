# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `needs_user`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Preflight reconciliation for this continuation
The GitHub skill was loaded, then the mandatory coordination files were read from `main` in exact order:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates matched run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

Actual GitHub state at continuation start:
- `main`: `84eaa3882be97c3d9beaa3f82d92724677988160`
- work/PR head: `06d75afc077e6d0d4982a31710015825e4e575b2`
- PR #109 open/draft/unmerged; mergeable observed true

Previously validated remote Inventory/Fire Bolt/Arcana, fresh Character flows, prepared Combatant, live-DM adjudication/Undo, theater-of-mind spatial action, Host preparation metadata, non-fixture live mechanics continuity, mounted Play-workspace viewport/focus structure, and unchanged connected lifecycle gates were not manually repeated.

## Completed this continuation — P14.10 role scoping and recovery UX
Final validated work/PR head: `a750ae844c8a0ce831e4c873574d074616eab3c0`.
Final product boundary: `6e424ce156634956af4d9c90a9a5d4bc3f4755f6`.

### Investigation
- The newly mounted `PlaySessionDock` could render its player launcher while a Host session was active because its only gate was snapshot hydration.
- `ProductionPlayerLobbyBridge` also lacked explicit non-host scoping and visible reconnect/disconnect recovery guidance.
- Host bind failure is already represented authoritatively by the production lifecycle adapter as an offline/incompatible snapshot with `compatibilityMessage = "Host start failed: ..."`; however, the Host bridge previously disappeared in that state, leaving the failure without a dedicated production recovery surface.
- Existing `production-player-lobby.css` already hides the legacy generic Join-by-IP card and reference-flow copy, so the large historical `App.tsx` shell did not need to be rewritten.
- Base Host authority is `snapshot.session.role === "host"`; top-level `snapshot.role === "dm"` is not an invariant of `hostSession()`. The patch preserves this existing model.

### Test-first progression
- `503ebc3b51846783b74a5cafa2796c46af1f7b1b` expanded `productionPlayWorkspaceAccessibility.test.ts` to require player/non-host surface scoping, explicit reconnect/disconnect guidance, visible Host bind-failure recovery, loading guidance, legacy Join-card suppression, and no `Ctrl+Shift+D` dependency.
- UI `31986077333`, frontend `95261238226` failed only the new fourth test at the first missing Play-dock role assertion; all three pre-existing P14.10 structure assertions passed.
- `01e6450e0ff023aa2c1aa3ce5c394101a4e094f9` corrected the new test's Host role assumption after inspecting the actual Host authority contract.

### Product repair
- `426c498523b0d29330900f21ce877128a62c63a5` scopes `PlaySessionDock` to top-level player/non-host surfaces and adds explicit client reconnect/disconnect status guidance.
- `9d394448347bc82c76127498e8869c1d7aeabec2` applies the same player/non-host scoping to `ProductionPlayerLobbyBridge` and adds `aria-live` reconnect/disconnect guidance.
- `6e424ce156634956af4d9c90a9a5d4bc3f4755f6` adds a visible Host-start-failure recovery card using the existing authoritative compatibility message, and normal Host status now reflects connected/reconnecting/disconnected state.
- No connected protocol, mechanics runtime, storage ownership, or source-of-truth changed.

### Test-contract correction
- Exact-head UI initially failed the older `playSessionDockStructure.test.ts` because it searched only the literal guard `if (!snapshot) return null;` and therefore could not recognize the new combined hydration/role guard.
- CI logs showed no Hook-order defect: the same three `useState` hooks remain before the first guard and no hooks occur after it.
- `a750ae844c8a0ce831e4c873574d074616eab3c0` updates only that structure test to locate the first `if (!snapshot...` guard while retaining the Hook-order invariants.

### Exact validation
- UI push `31986324263`, frontend job `95261871414` at `a750ae844c8a0ce831e4c873574d074616eab3c0`: **completed success**. Named-rule, PlaySessionDock hydration/tab structure, new P14.10 role/recovery accessibility, Host preparation metadata, live mechanics continuity, existing Phase14 production batch, creation/progression/spell regressions, Phase09 mechanics, TypeScript and production build all green.
- Main Playable `31986326671`, playable-contract job `95261895056` at the same exact head: **completed success**. Full build plus Phase11, Phase12, Phase13, prepared Combatant, live-DM adjudication/Undo, live Combatant theater-of-mind action, Host preparation metadata, live mechanics continuity and P14.10 accessibility structure all green.
- Main Windows job `95262238417` was automatically in progress after the playable-contract completed. It is not the required human two-instance acceptance and is not completion evidence for P14.10/P14.13.

## Architecture preserved
- Owning Client Character Library remains the durable Character source; Host projections remain ephemeral.
- Host canonical content/runtime remains mechanics authority.
- Existing connected ledger, Scene/spatial/runtime, ResolutionEvent, reconnect/idempotency and event-native Undo remain authoritative.
- `productionJoinCharacters` remains the production no-fixture Character-entry policy.
- Host scoping remains based on `session.role === "host"`; no false top-level DM invariant was introduced.
- No fixture fallback, duplicate connected protocol, duplicate durable source, tactical-map subsystem, or merge was introduced.

## Why dispatch is now `needs_user`
The recorded automated P14.10 boundary is complete. The next required gates are explicitly human desktop acceptance and cannot be truthfully performed by the current GitHub/CI-only environment. Starting more automated source work would either repeat validated boundaries or improperly substitute CI for human acceptance.

## Blocking Next Exact Action
Human acceptance must be performed against exact work head `a750ae844c8a0ce831e4c873574d074616eab3c0` unless a human-found issue causes a later fix head.

1. P14.10 human common-viewport/keyboard walkthrough: player/non-host dock scoping, no Host overlap, long-list scrolling, keyboard focus/selected/disabled/focus-visible behavior, focus-accessible detail, reduced-motion result access, reconnect/disconnect guidance, Host bind-failure recovery, and no Debug Dock requirement.
2. P14.13 Windows two-instance human walkthrough: actual Host bind -> preparation/lobby -> persisted host-unknown Character join -> compatibility/projection -> Ready -> Freeform/Initiative start -> visible action -> Host authoritative Resolution -> convergence -> disconnect/reconnect -> explicit end -> clean restart -> owning Client durable state check.
3. Record exact source SHA and concrete pass/fail notes. If an issue is found, resume test-first at only that affected boundary.
4. If both human gates pass, then and only then perform final exact-head Windows artifact verification: executable, BUILD exact SHA/run id, walkthrough contents, artifact `head_sha`, digest/ZIP SHA-256 and ZIP contents.
5. PR #109 remains draft/unmerged; no merge is authorized.

## Current coordination write batch
- `main` was re-fetched immediately before writes and remained `84eaa3882be97c3d9beaa3f82d92724677988160`.
- PLAN was written first as required: commit `09014263fe47488a6c732c23b23bdf9b0711099b`.
- This STATE write is second.
- `control.json` must be written last with status `needs_user`.

## Dispatch recommendation
`needs_user`
