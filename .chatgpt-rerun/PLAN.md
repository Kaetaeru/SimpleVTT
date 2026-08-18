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
- dispatch recommendation: `continue`

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/RuleModule validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts remain presentation state only;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency;
- production cleanup must remove only proven unreachable/reference wiring and must not replace canonical runtime authorities;
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`04d8af303e4f77eeb62801f8fd99e07146a2e48e`

Latest source commit:
- `04d8af303e4f77eeb62801f8fd99e07146a2e48e` — `Polish contextual DM and content UX`

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect at `28f3700e...`.
9. **Contextual DM/Content polish + production dead-wiring cleanup** at `04d8af30...` on affected Linux/application gates:
   - DM freeform/preparation uses existing `instantiateCombatant`/`removeCombatant` APIs for contextual Encounter preparation; no new store or mechanics path;
   - empty Host Encounter gives an actionable in-place preparation path instead of pointing to an unreachable sidebar destination;
   - routine Play copy removes implementation-facing `capability` wording;
   - Content is the primary addon review/install surface and explains that installed content is then searched from Rules;
   - user-facing addon guidance removes routine RuleModule/Capability/mechanics/progression jargon while retaining existing validation/install authority;
   - production `main.tsx` no longer imports or loads the unmounted legacy `PlaySessionDock` or its CSS; the reference source file remains for historical tests and no canonical runtime module was removed.

## Validation evidence
### Portrait/handout head `28f3700e...`
- UI `32187690842` / `95875015492`: success.
- Persistence `32187690744` / application-contract `95875014950`: success.
- Persistence Windows `95875014764`: **success**.
- Phase 12 `32187690780` / connected-protocol `95875015147`: success.
- Phase 12 Windows `95875316302`: **success**, including Tauri transport/persistence, Windows executable build, staging and artifact upload.

### Current polish/cleanup exact head `04d8af30...`
- UI run `32188621592` / frontend `95877878308`: **success**.
  - PlaySessionDock production-wiring cleanup test: success;
  - contextual DM/Content non-Character UX test: success;
  - all reported UI/product regressions: success;
  - Typecheck and production build: success.
- Main Playable run `32188621652` / playable-contract `95877878422`: **success**.
  - full UI/rules/TypeScript/frontend: success;
  - offline walkthrough, connected authority, arbitrary Character SessionProjection, DM prepared/live flows, Undo, theater-of-mind and accessibility: success.
- Phase 12 run `32188621643` / connected-protocol `95877878129`: **success**.
  - connected authority suite: success;
  - Phase 11 offline walkthrough: success;
  - production frontend gate: success.
- Persistence run `32188621614` / application-contract `95877878078`: **success** including persistence contracts and production build.
- Same-head automatic Windows jobs are still in progress at checkpoint time and must not be manually rerun merely because watcher execution restarts:
  - Phase 12 `windows-connected-playable` job `95878210229`;
  - Main Playable `windows-playable` job `95878131296`;
  - Persistence `tauri-storage` job `95877878039`.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `04d8af30...`, do not repeat any of the nine validated boundaries or the contextual DM/Content audit.
3. Check jobs `95878210229`, `95878131296`, and `95877878039`; record their final results without manual rerun if already complete.
4. Resume only the remaining proven dead-legacy cleanup: audit the old local-only `App.tsx` sheet/create/scene functions against the current router/import graph and remove them only if every dependency is demonstrably unreachable from production.
5. Do not remove the current `ProductionPlayScreen`, dual Sheet router, V10 Character creation, current LevelUp path, connected/session/content authorities, or reference files still required by tests.
6. Run affected gates after any cleanup; do not rerun unchanged validated slices solely because the watcher restarted.
7. After source convergence, obtain one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
8. Human Windows acceptance remains required for standalone Sheet-at-table use and two-instance Host/Client play including image reveal/reconnect; do not claim final V0.9 completion before that acceptance.
9. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
