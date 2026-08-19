# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current source HEAD
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

This is the current human-acceptance repair candidate. It is not yet human-accepted. Do not fall back to `bed3119c...`.

## Durable GitHub/watch conventions
- `STATUS.md` and human-facing watcher status text are Korean.
- Invoke the matching GitHub plugin skill first; direct `gh` is not the independent/default path.
- CI failures use `gh-fix-ci` first; when its `gh` dependency blocks log retrieval, the user-authorized connector log fallback may be used.
- No speculative fixes without exact CI evidence or exact human repro.
- Never merge PR #109 without explicit user authorization.

## Human acceptance defects that reopened sequence 3
The user tested the prior Windows artifact and reported:
1. production dice looked completely different from the prior UI-demo form/design;
2. attack was unavailable in the demo session;
3. the official Character Sheet layout version was not exposed;
4. clicking different existing Character cards always entered one same Character.

These observations are authoritative acceptance failures even though the prior automated head was green.

## Implemented fixes
### Dice
- shared `PhysicsDice3D` now uses the UI-demo bronze/warm facet language.
- d10 no longer uses `CylinderGeometry`; it uses a ten-face polyhedral helper.
- Three.js/cannon-es physics and authoritative-result convergence remain presentation-only.

### Demo attack
- reference offline demo exposes a real 5 ft melee relation for the default Aelar/wolf case.
- attack target eligibility is projected through existing `runtimeSpatialRelation` visibility/range facts.
- resolution still uses the existing authoritative attack transaction/resolution services.

### Official layout exposure
- `CharacterLibraryUxBridge` exposes `SimpleVTT 시트 / 공식 시트 스타일` in the Character Library header using existing persisted sheet-layout preferences.
- existing `CharacterSheetPlayScreen` and `OfficialCharacterSheetPlayScreen` remain the two presentation layouts over one active Character.

### Character selection
- regular Character Library cards now resolve their corresponding `snapshot.characters[index].id` through existing `selectProductionCharacter(character.id)`.
- the legacy reference Mira card is materialized into a distinct playable sheet in the adapter's existing Character collection; no second Character store is introduced.

## Regression coverage
- new `productionAcceptanceWindowsRegression.test.ts`: legal reference melee attack completes through authoritative runtime; Mira/Aelar selection is distinct.
- `productionLocalCharacterSwitch.test.ts`: reference selection + existing remote SessionProjection preservation.
- `characterSheetPlayableUx.test.ts`: Character Library exposes official layout preference and existing dual-sheet authority remains intact.
- dice structure tests: demo bronze treatment, shared physics renderer, polyhedral d10, no `CylinderGeometry` regression.
- UI workflow includes these acceptance regressions.

## Intermediate CI diagnosis
At `461f4f62de159fe8d0b4e4fadd4a20340efd1db8`, the four new acceptance regressions all passed. A later UI step failed only because an older duplicate structural test still required `CylinderGeometry` for d10.

CI handling followed policy:
1. invoked `gh-fix-ci` first;
2. `gh` was unavailable;
3. used the user-authorized connector log fallback;
4. exact log showed only the stale `visualDiceStructure.test.ts` `/CylinderGeometry/` assertion;
5. `d942d58a...` changed only that test expectation to the new polyhedral d10 rule.

No product source was changed after `461f4f62...`.

## Exact-head validation evidence at `d942d58a...`
Completed success:
- UI `32204865620`, frontend `95926003383`: **success**. Includes the human-acceptance regressions, Character/session integration, Phase 09 mechanics suite, TypeScript and production build.
- Rules Domain `32204865592`: **success**.
- Contract validation `32204865594`: **success**.
- Persistence `32204865644`:
  - application-contract `95926003457`: **success**;
  - tauri-storage `95926003360`: **success**.
- Main Playable `32204865588`, playable-contract `95926017359`: **success**.
- Phase 11 `32204865635`, offline-walkthrough `95926003264`: **success**.
- Phase 12 `32204865632`, connected-protocol `95926003189`: **success**.

Still running when this checkpoint was written:
- Main Windows `95926276820`: Tauri persistence/session transport verification in progress, then executable build/stage/upload.
- Phase 11 Windows `95926114975`: Windows playable executable build in progress.
- Phase 12 Windows connected `95926150169`: Tauri session transport/persistence verification in progress, then executable build/stage/upload.

These jobs were already running. On watcher continuation, **fetch their current results; do not restart them**.

## Untouched validated boundaries — do not repeat merely due restart
- connected authority/reconnect/idempotency/Undo;
- Direct-IP session entry;
- content parity before Ready;
- persistence architecture;
- portrait and image handout/reconnect;
- combat VFX;
- dead-legacy cleanup and named-rule baseline alignment.

## Next Exact Action
1. Mandatory watcher preflight in exact README -> control -> STATE -> PLAN order.
2. Trust GitHub actual state and recheck PR #109 source HEAD.
3. If HEAD remains `d942d58a...`, do not redo source diagnosis or already-green UI/Linux gates.
4. Fetch Main Windows `95926276820`, Phase 11 Windows `95926114975`, and Phase 12 Windows connected `95926150169` results.
5. If a Windows failure is observed, use `gh-fix-ci` first then approved connector logs if needed; fix only that exact failure.
6. If Main Windows succeeds with executable build/stage/upload, fetch the Main Playable run `32204865588` artifact for exact HEAD `d942d58a...`, download and deliver it to the user.
7. After artifact delivery, set `needs_user` and require a focused human retest of exactly the four original observations: dice design, demo attack, official layout, distinct Character cards.
8. V0.9 is not complete until that human retest succeeds.
9. PR #109 stays draft/unmerged.

## Dispatch recommendation
`continue`
