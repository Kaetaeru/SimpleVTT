# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current source HEAD
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

This is the exact-head human-acceptance repair candidate. Automated Windows validation is complete and green. It is not yet human-accepted.

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
- reference Mira is a distinct playable sheet in the existing Character collection; no second Character store is introduced.

## Regression coverage
- `productionAcceptanceWindowsRegression.test.ts`: legal reference melee attack completes through authoritative runtime; Mira/Aelar selection is distinct.
- `productionLocalCharacterSwitch.test.ts`: reference selection + existing remote SessionProjection preservation.
- `characterSheetPlayableUx.test.ts`: Character Library exposes official layout preference and existing dual-sheet authority remains intact.
- dice structure tests: demo bronze treatment, shared physics renderer, polyhedral d10, no `CylinderGeometry` regression.

## CI diagnosis history
At `461f4f62de159fe8d0b4e4fadd4a20340efd1db8`, the four new acceptance regressions passed. A later UI step failed only because an older duplicate structural test still required `CylinderGeometry` for d10.

CI handling followed policy:
1. invoked `gh-fix-ci` first;
2. `gh` was unavailable;
3. used the user-authorized connector log fallback;
4. exact log showed only the stale `visualDiceStructure.test.ts` `/CylinderGeometry/` assertion;
5. `d942d58a...` changed only that test expectation to the new polyhedral d10 rule.

No product source was changed after `461f4f62...`.

## Exact-head validation evidence at `d942d58a...`
Completed success:
- UI `32204865620`, frontend `95926003383`: **success**. Includes human-acceptance regressions, Character/session integration, Phase 09 mechanics suite, TypeScript and production build.
- Rules Domain `32204865592`: **success**.
- Contract validation `32204865594`: **success**.
- Persistence `32204865644`: application-contract `95926003457` **success**; tauri-storage `95926003360` **success**.
- Main Playable `32204865588`: playable-contract `95926017359` **success**; Main Windows `95926276820` **success** including Tauri persistence/session transport, executable build, staging and upload.
- Phase 11 `32204865635`: offline-walkthrough `95926003264` **success**; Windows `95926114975` **success** including executable build/stage/upload.
- Phase 12 `32204865632`: connected-protocol `95926003189` **success**; Windows connected `95926150169` **success** including Tauri session transport/persistence, executable build/stage/upload.

## Exact-head artifact delivered
- Main Playable artifact id `9348955693`
- name `SimpleVTT-Main-Playable-d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- run `32204865588`
- head `d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- digest `sha256:441b8eac5a0cea1cf9cbaff6788f2e7e4d0099f07d5d2c6c0deca1a2f3fefc96`
- downloaded into the current ChatGPT conversation as `SimpleVTT-Main-Playable-d942d58a.zip` for user testing.

## Untouched validated boundaries — do not repeat merely due restart
- connected authority/reconnect/idempotency/Undo;
- Direct-IP session entry;
- content parity before Ready;
- persistence architecture;
- portrait and image handout/reconnect;
- combat VFX;
- dead-legacy cleanup and named-rule baseline alignment.

## Next Exact Action
1. Do not rebuild or rerun already-green exact-head gates unless the source changes.
2. Wait for the user to run the delivered Windows Main Playable artifact.
3. Human retest exactly: dice appearance; demo attack; official sheet layout; distinct Character-card selection.
4. If one still fails, reauthorize this same sequence as `continue`, record the exact human repro, and fix only that failure.
5. If all four pass, record human acceptance before any V0.9 completion decision.
6. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
