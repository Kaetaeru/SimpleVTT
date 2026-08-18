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
`669f867d3b8ce1ef94aa513e779e64c51ffa606e`

At this execution's final product-branch reconciliation, PR #109 still pointed to that exact SHA and remained open, draft, mergeable and unmerged. No product-branch source commit was made during this watcher window.

## Preflight reconciliation completed
The mandatory watcher files were read from `main` in protocol order before work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

The handed-off `run_id=b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, `sequence=2`, `task_id=v1-product-experience-overhaul`, `status=continue` matched GitHub. GitHub's real PR/work-branch state also matched the checkpoint head `669f867...`, so no stale-source reconciliation was needed.

## Work completed in this execution
### Dual Character Sheet source audit
`.agents/V0_9_PRODUCT_REFERENCE.md` was re-read from `agent/108-production-play-session-ux`. The next incomplete slice remains dual Character Sheet presentation.

The current production paths were inspected in detail:
- `src/CharacterSheetPlayScreen.tsx` — current SimpleVTT digital sheet and standalone local roll presentation; uses `snapshot.activeCharacter`.
- `src/app/characterSheetV10Projection.ts` — canonical sheet presentation projection already provides Hit Die, saving-throw proficiencies, complete skill mapping/bonuses, Passive Perception, class/species/feat/background traits, spells and level 1–9 slot maxima.
- `src/app/contracts.ts`, `creationContracts.ts`, `progressionContracts.ts` — confirm the Character fields actually persisted/available for Official rendering, including languages/tool proficiencies/gold/notes/Hit Dice/spell-slot maxima.
- `src/app/spellcastingRuntimeContracts.ts` and `productionSpellcasterProjectionAdapter.ts` — confirm `scene.spellcastingByActor[character.id]` owns runtime spell attack modifier, Save DC and current/max slot state, while `scene.actionsByActor[character.id]` exposes supported spell action metadata.
- `src/app/AppProvider.tsx` and existing App inventory UI — confirm existing edit/level-up/item mutation handlers must be reused.
- existing `tests/ui/characterSheetPlayableUx.test.ts` and `.github/workflows/ui.yml` — confirm the affected targeted test already participates in the UI workflow and frontend build gate.

### Important implementation boundaries established
- Both layouts must receive the same canonical `snapshot.activeCharacter`; no second Character store or duplicated Character persistence.
- Layout choice is a presentation-only persisted preference with default `SimpleVTT Sheet`.
- Official Character page is a real React information layout, not a PDF/image and not a parchment reskin.
- Existing supported ability/save/skill/Initiative/attack/damage/Hit Die/item operations stay on existing presentation handlers/services.
- Official Spellcasting must read spell attack/Save DC/current slots from existing projections and action metadata; do not recalculate those mechanics in the screen.
- No canonical stored fields were found for Alignment, XP, Player Name or Death Save state. Official UI must show those as unavailable/untracked, not fabricate values.

### Local draft status
A local, uncommitted implementation draft was prepared for:
- `src/app/sheetLayoutPreferences.ts`;
- updated `src/CharacterSheetPlayScreen.tsx` with dual layouts and Official Character/Spellcasting pages;
- `src/character-sheet-layouts.css`;
- expanded `tests/ui/characterSheetPlayableUx.test.ts`.

The draft passed TypeScript transpile syntax checks for the TS/TSX files and balanced-brace CSS inspection. However, this execution environment has no `gh` executable and container network access cannot reach GitHub, while the connector write API requires full file contents rather than a mounted local file. The hard 20-minute watcher window reached checkpoint before a safe atomic product source commit could be assembled. Therefore the local draft is **ephemeral and non-authoritative**; the next invocation must not assume it exists. No partial product source was pushed.

One unattached Git blob (`eb27a4cb7f9d1df22ae590ac6ff4f2a763b7404d`) was created while testing connector transfer for the preference module. It is not referenced by any tree/commit/branch and has no product effect; ignore it.

## Validated slices — do not repeat unless touched
Current exact validated work head remains `669f867d3b8ce1ef94aa513e779e64c51ffa606e`.

1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.

At this exact head, UI run `32171564923` / frontend job `95823699460` succeeded, and Phase 11 offline walkthrough job `95823700000` succeeded. Historical unchanged mechanics/persistence/network evidence remains reusable. Do not rerun these simply because the watcher restarted.

## Next Exact Action
1. Perform watcher preflight. If PR #109 still points to `669f867...`, do not re-audit the source files listed above.
2. Implement the dual Character Sheet slice directly on `agent/108-production-play-session-ux` using the audited boundaries:
   - presentation-only persisted `simplevtt | official` layout preference;
   - same `snapshot.activeCharacter` for both modes;
   - preserve current SimpleVTT sheet behavior;
   - Official Character page with paper-style information arrangement and existing interactive controls;
   - dedicated Official Spellcasting page with level 0–9 sections, summary, current/max slots, known/prepared state and supported local spell roll controls;
   - unknown Alignment/XP/Player Name/Death Saves rendered explicitly as untracked;
   - no new mechanics arithmetic/store/protocol.
3. Add/extend focused tests in `tests/ui/characterSheetPlayableUx.test.ts` for same Character identity/state, layout persistence, Official interactivity, spell 0–9/current slots and mechanics-presentation separation.
4. Load new Official layout CSS from the sheet module or current style chain using original SimpleVTT styling only; no copied D&D logos/artwork/parchment assets.
5. Recheck PR HEAD immediately before write, fast-forward only, then run the affected UI/frontend workflow and inspect the exact-head TypeScript/build result.
6. After dual Sheet is green, continue: direct-IP Session + validated automatic content parity; portrait + DM handout/reconnect; contextual DM/Content/Rules polish and dead-legacy cleanup.
7. PR #109 remains draft/unmerged. Never merge without explicit user authorization.

## Architecture preserved
- owning Client Character Library is durable Character authority; Host projections are ephemeral;
- Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains mechanics path;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance/layout preferences are presentation only;
- no second store/protocol/resolver/event ledger, tactical map/Fog/path/minimap/LOS or cloud dependency.

## Coordination writes
- PLAN checkpoint commit on `main`: `050ae2880e1616fa6359e88a2b28a76192955e76`.
- STATE is this checkpoint and was written after PLAN.
- control is written last with `status=continue` and sequence `3`.

## Dispatch recommendation
`continue`
