# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `blocked`

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts remain presentation state only;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency;
- production cleanup removes only proven unreachable UI/reference wiring and must not replace canonical runtime authorities;
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`5c70b3028aed70b0fc5ddafafe119f40174df833`

Latest source commit:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

The branch was fast-forwarded non-force from validated polish head `04d8af303e4f77eeb62801f8fd99e07146a2e48e` after rechecking PR #109 at that exact old head.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`.

## Recovered same-head Windows evidence for `04d8af30...`
All three jobs previously left automatic/in-progress are now **success**, without manual rerun:
- Persistence `tauri-storage` job `95877878039`: success.
- Phase 12 `windows-connected-playable` job `95878210229`: success including Tauri transport/persistence verification, Windows connected executable build, staging and upload.
- Main Playable `windows-playable` job `95878131296`: success including Tauri persistence/session transport verification, Windows playable executable build, staging and upload.

## Current dead-legacy cleanup candidate
`5c70b302...` removes only local App surfaces that the current router no longer calls:
- old `CharacterSheetScreen` / old Character create helpers and their private inventory/ability-builder helpers;
- old `useTargeting` / `PlayerSceneScreen` / `DmSceneScreen` / `ActionConsole` / entity inspector-targeting helpers;
- imports/constants/helpers used only by those removed blocks.

Current production routing remains:
- `CharacterSheetPlayScreen` for Character Sheet;
- `CharacterCreateScreenV10` for create/edit;
- `ProductionPlayScreen` for scene/play;
- current local `LevelUpScreen/LevelStep` retained;
- current ResolutionDrawer, DM adjudication, Content/Rules/Session/Settings/Debug surfaces retained.

`tests/ui/productionNonCharacterUxRedesign.test.ts` was moved from inspecting obsolete local scene functions to asserting the real `ProductionPlayScreen` route and preventing those legacy functions from returning.

## Current validation status for `5c70b302...`
Automatic runs started normally.

### Main Playable — blocking failure
- run `32189591188`
- job `95880814298` (`playable-contract`)
- step `Verify full UI, rules, TypeScript, and production frontend`: **failure**
- downstream steps skipped because of this failure.

The exact failure log/root cause is **not diagnosed**. The required `gh-fix-ci` workflow was invoked, but this execution environment has no GitHub CLI:
- `gh --version && gh auth status` -> `gh: not found` (exit 127).

Per the installed CI-fix workflow, do not use connector logs as a substitute and do not make speculative source changes without the actual failing log.

### Other same-head runs
- UI run `32189591171` started; exact final result was not established before blocker checkpoint.
- Phase 12 run `32189591122` started; exact final result was not established before blocker checkpoint.
- Persistence run `32189591129` started; exact final result was not established before blocker checkpoint.
- Other automatic Rules/Contract/Phase11 runs also started; do not claim results without checking.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch, or PR #109 moved.
2. While control is `blocked`, do not continue source edits.
3. When work is re-authorized with `continue`, if work HEAD remains `5c70b302...`, do not repeat the reachability audit or previously validated product slices.
4. Invoke `gh-fix-ci` before CI diagnosis. Verify `gh --version` and `gh auth status`.
5. In an environment with authenticated GitHub CLI, inspect run `32189591188`, job `95880814298`, failing step `Verify full UI, rules, TypeScript, and production frontend`; capture the exact failing test/type/build output.
6. Fix only the observed failure. Do not guess from the source diff.
7. Recheck PR HEAD immediately before any branch write and use non-force fast-forward only.
8. Validate affected UI/Main gates at the resulting exact head; observe automatic connected/persistence/Windows gates without manually rerunning unchanged historical boundaries.
9. After source convergence, obtain one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
10. Human Windows acceptance remains required for standalone Sheet-at-table use and two-instance Host/Client image reveal/reconnect; do not claim final V0.9 completion before that acceptance.
11. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`blocked`
