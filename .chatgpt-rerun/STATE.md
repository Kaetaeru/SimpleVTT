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

## Current work head
`04d8af303e4f77eeb62801f8fd99e07146a2e48e`

The work branch was advanced by a single non-force fast-forward from `28f3700eb92ab93bacb589dd07be792bf228b3a0` to `04d8af303e4f77eeb62801f8fd99e07146a2e48e`. PR #109 was rechecked immediately before the ref update and remained open/draft/unmerged at the expected old head.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates reconciled to:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task `v1-product-experience-overhaul`
- dispatch `continue`
- starting work HEAD `28f3700eb92ab93bacb589dd07be792bf228b3a0`

Validated Play/Dice/VFX/Appearance/dual-Sheet/direct-IP/content-parity/portrait-handout work was not repeated.

## Prior pending Windows results recovered without rerun
The two same-head jobs left pending at the previous checkpoint are now both confirmed successful:
- Persistence run `32187690744` / `tauri-storage` job `95875014764`: **success**.
- Phase 12 run `32187690780` / `windows-connected-playable` job `95875316302`: **success**.
  - Tauri transport/persistence verification: success;
  - Windows connected executable build: success;
  - artifact staging/upload: success.

No manual rerun was requested or performed.

## Work completed in this execution
### Contextual DM Encounter preparation
`src/ProductionPlayScreen.tsx` now reuses the existing `instantiateCombatant` and `removeCombatant` AppProvider APIs directly from the current production play surface.
- Encounter management is visible only for DM while not in Initiative and while offline or Host lifecycle is `preparing`.
- An empty DM Encounter now offers in-place `Encounter 준비` buttons using existing `snapshot.combatantDefinitions` instead of directing the user to an unreachable sidebar destination.
- A non-empty manageable Encounter offers a compact `Encounter 편집` disclosure and can remove the selected Combatant.
- No new React state store, Character/content authority, network protocol, ResolutionEvent path, or tactical map semantics were introduced.

### Product-language cleanup
- Production Play routine copy no longer exposes `capability` as user-facing terminology; it refers to available choices/actions instead.
- `V1ContentScreen` explicitly owns addon file review/install and tells the user installed addons become searchable from Rules.
- Routine addon guidance no longer exposes RuleModule/Capability/generic-Catalog/mechanics/progression jargon while still using the same existing validation/install APIs internally.

### Proven dead production wiring cleanup
`src/main.tsx` no longer imports or loads the unmounted legacy `PlaySessionDock` or `play-session-dock.css`.
- `PlaySessionDock.tsx` itself remains as a reference/history source because tests still intentionally inspect it.
- `CombatSpellHudBridge` wiring remains untouched because existing tests and behavior still depend on it.
- Current portrait/handout/session/production bridges remain mounted.

### Dead-code audit deferred safely
The current router proves `App.tsx` production routes use `CharacterSheetPlayScreen`, `CharacterCreateScreenV10`, `ProductionPlayScreen`, and current LevelUp/Session/Content surfaces. The same file still contains older local-only sheet/create/scene helper functions. They appear unreachable, but this execution did not perform a high-risk mass deletion. The next cleanup must prove every helper/import dependency before removing that block.

### Source commit
- `04d8af303e4f77eeb62801f8fd99e07146a2e48e` — `Polish contextual DM and content UX`

Focused tests updated:
- `tests/ui/playSessionDockStructure.test.ts`
- `tests/ui/productionNonCharacterUxRedesign.test.ts`

## Validation evidence for exact head `04d8af30...`
### UI
- run `32188621592`
- frontend job `95877878308`: **success**
- PlaySessionDock production wiring cleanup: success
- contextual DM/Content product UX test: success
- all reported product regressions: success
- Typecheck and production build: success

### Main Playable
- run `32188621652`
- playable-contract job `95877878422`: **success**
- full UI/rules/TypeScript/frontend: success
- Phase 11 complete offline walkthrough: success
- Phase 12 connected authority: success
- Phase 13 arbitrary Character SessionProjection: success
- DM prepared Combatant, live adjudication/Undo, live theater-of-mind Combatant action, preparation metadata/content, live mechanics continuity and production accessibility: success
- windows-playable job `95878131296`: **in progress** at checkpoint time; do not manually rerun on watcher restart.

### Phase 12 Connected Session
- run `32188621643`
- connected-protocol job `95877878129`: **success**
- connected-session authority protocol: success
- Phase 11 offline walkthrough: success
- production frontend gate: success
- windows-connected-playable job `95878210229`: **in progress** at checkpoint time; do not manually rerun on watcher restart.

### Persistence
- run `32188621614`
- application-contract job `95877878078`: **success**
- Character/content/module persistence contracts: success
- production build: success
- tauri-storage job `95877878039`: **in progress** at checkpoint time; do not manually rerun on watcher restart.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...` on affected Linux/application gates.

Watcher restart alone is not a reason to rerun any of these boundaries.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `04d8af30...`, do not repeat any validated slice or this contextual polish audit.
3. Check jobs `95878210229`, `95878131296`, and `95877878039`; record their final results without manual rerun if complete.
4. Resume only the remaining dead-legacy cleanup: prove reachability of the older local-only `App.tsx` sheet/create/scene helper block and remove only functions/imports that are demonstrably unreachable from the current router and external tests.
5. Preserve current ProductionPlay, dual Sheet, V10 Character creation, LevelUp, Session/content/connected authorities and any reference source still required by tests.
6. Run only affected gates after cleanup.
7. Then collect one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
8. Human Windows acceptance remains required for standalone Sheet-at-table use and two-instance Host/Client image reveal/reconnect; do not claim final V0.9 completion before it.
9. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN for this checkpoint was written first on `main` as commit `f08ac70ca2c0ec32708d100f6812725a8ac37700`.
- STATE is this durable checkpoint and is written after PLAN.
- STATUS may be refreshed next for human visibility.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
