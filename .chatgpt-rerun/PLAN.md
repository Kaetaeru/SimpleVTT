# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `continue`

## Authoritative product reference
The durable V0.9 contract is `.agents/V0_9_PRODUCT_REFERENCE.md` at reference commit `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`. Interactive HTML demos are visual/interaction references only and must not replace production React/runtime architecture.

Design precedence remains:
1. newest explicit user direction;
2. `.agents/V0_9_PRODUCT_REFERENCE.md`;
3. `.agents/V1_PLAY_SURFACE_REVISION.md`;
4. `.agents/V1_PRODUCT_EXPERIENCE.md`;
5. Phase 14 UX documents for preserved runtime/architecture boundaries.

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains the mechanics path;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance/layout preferences are presentation state only;
- official monsters/encounters are not silently rebalanced;
- no second Character/content store, resolver, protocol or event ledger;
- no tactical grid/token movement/Fog/pathfinding/minimap/LOS/cloud-account dependency.

## Validated slices — do not repeat unless touched
Current validated work HEAD remains `669f867d3b8ce1ef94aa513e779e64c51ffa606e`.

1. Production Play — one Initiative strip, scene theater, no permanent sidebars, bottom actor/resource/hotbar UI, canonical action boundaries and Freeform behavior.
2. Fast Visual Dice — production Three.js/cannon-es path, <=1.5 s presentation, result reel/formula expansion, Natural 20/1 semantics, no connected mechanics reroll.
3. Composable Combat VFX — presentation-only delivery+element projection with no hidden-defense leakage or mechanics mutation.
4. Appearance — independent Dark/Light and persisted accent, curated/custom color, semantic colors preserved.

Exact-head evidence at `669f867...` remains UI run `32171564923` / frontend job `95823699460` success and Phase 11 offline walkthrough job `95823700000` success. Do not rerun these unchanged slices merely because a watcher invocation restarted.

## Dual Character Sheet contract
Both layouts must read the same `snapshot.activeCharacter` and canonical projections/handlers:
- **SimpleVTT Sheet** — application-native interactive digital layout.
- **Official sheet layout** — original SimpleVTT React rendering following the recognizable standard D&D 5e paper information arrangement, without copied logos/artwork and without parchment-theme imitation.

Official Character page must cover the available canonical equivalents of Character Name, Class/Level, Background, Player Name, Race/Species, Alignment, XP, six abilities, Inspiration, Proficiency Bonus, saves, all skills, Passive Perception, proficiencies/languages, AC, Initiative, Speed, HP/temp HP, Hit Dice/Death Saves, Attacks & Spellcasting, Equipment/currency, Personality/Ideals/Bonds/Flaws and Features & Traits. Unsupported stored fields must be shown as unavailable/untracked rather than invented.

Supported ability/save/skill/Initiative/attack/damage/Hit Die/item operations remain interactive through existing handlers. Layout preference persists independently as presentation state and never becomes Character state.

Official Spellcasting page must provide Character Name, Spellcasting Class/Ability, Save DC, Attack Bonus, Cantrips/level 0 and levels 1–9, slot state, known/prepared state and supported local spell roll actions over the same canonical spell/progression/resource projections.

## Current execution findings
This watcher invocation completed the required preflight reconciliation and re-read `.agents/V0_9_PRODUCT_REFERENCE.md`. GitHub still reports PR #109 at exact head `669f867d3b8ce1ef94aa513e779e64c51ffa606e`, open/draft/unmerged.

The dual-Sheet source audit is complete and should not be repeated next invocation unless the branch head changes:
- `src/CharacterSheetPlayScreen.tsx` currently owns standalone local roll presentation and already reads `snapshot.activeCharacter`.
- `projectOfficialSheet()` already supplies hit die, save proficiencies, full skill projection, passive Perception, class/species/feat/background traits, spells and level 1–9 slot maxima.
- `creationContracts.ts` augments Character with languages, tool proficiencies, gold, notes and spell collections.
- `progressionContracts.ts` augments Character with Hit Dice and spell-slot maxima.
- `scene.spellcastingByActor[character.id]` supplies canonical runtime spell attack modifier, Save DC and current/max slot state.
- `scene.actionsByActor[character.id]` supplies canonical spell action metadata where local attack/damage rolling is supported.
- `AppProvider` already exposes `editCharacterDraft`, `startLevelUp`, `toggleItemEquipped`, `toggleItemAttunement` and `useItem`; do not invent parallel mutations.
- no canonical Alignment, XP, Player Name or Death Save persistence was found in the audited Character contracts, so Official UI must not synthesize those values.

A local uncommitted implementation draft was syntax-checked during this execution, but because the execution window reached its hard checkpoint before a safe atomic GitHub source commit could be formed, **that local draft is not durable evidence and must not be assumed to exist in the next invocation**. No product-branch source was changed in this checkpoint.

## Next Exact Action
1. Preflight per `.chatgpt-rerun/README.md`; trust GitHub over this checkpoint if the work branch moved.
2. If PR #109 still points to `669f867...`, do **not** repeat the dual-Sheet source audit above and do not rerun validated Play/Dice/VFX/Appearance work.
3. Implement the dual-Sheet slice directly on `agent/108-production-play-session-ux`:
   - add a small presentation-only `sheetLayoutPreferences` module with default `simplevtt`, persisted `official`/`simplevtt` choice and safe storage failure handling;
   - update `CharacterSheetPlayScreen` so both layouts receive the same `snapshot.activeCharacter` and existing roll/item/edit/level-up handlers;
   - preserve the existing SimpleVTT sheet behavior;
   - add a real paper-arrangement Official Character page and a dedicated Official Spellcasting page;
   - render unsupported Alignment/XP/Player Name/Death Saves as untracked rather than fabricating state;
   - use `projectOfficialSheet`, `sheetAbilityModifier`, `sheetSaveBonus`, `scene.spellcastingByActor` and `scene.actionsByActor` rather than moving mechanics arithmetic into the screen.
4. Add focused tests to `tests/ui/characterSheetPlayableUx.test.ts` for same-Character identity, persisted layout preference, Official interactivity, spell levels 0–9/current slots and presentation-only mechanics boundaries.
5. Load the new layout CSS from the sheet module or existing main stylesheet chain; do not add copied D&D artwork/logos or parchment assets.
6. Form one source commit if practical, fast-forward only after rechecking PR HEAD, then run the affected UI/frontend workflow. Treat GitHub Actions TypeScript/build as authoritative because this environment has no authenticated `gh` CLI or networked checkout.
7. If dual Sheet is exact-head green, continue in order: direct-IP Session + validated automatic content parity; portrait + DM handout/reconnect; contextual DM/Content/Rules polish and dead-legacy cleanup.
8. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
9. Keep PR #109 draft/unmerged. Never merge without explicit user authorization.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent Home/shell reachability; Character create/import/edit/level-up/restart durability; both Sheet layouts over one Character; interactive official level 0–9 Spellcasting page; portrait and standalone Sheet rolls/resources; durable Light/Dark + accent; production physics dice; one top Initiative order and icon hotbar; composable presentation-only VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated Host-required declarative content parity; empty fresh Host Encounter with deliberate official Combatant addition; DM image reveal/withdraw and Client dismiss/reopen/reconnect; exact-head automated gates and human Windows acceptance. PR remains draft/unmerged until explicit merge authorization.

## Dispatch recommendation
`continue`
