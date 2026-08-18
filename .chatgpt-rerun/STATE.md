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
`e83fc37f60b6f42f0ed7b8c76329465ed55e3644`

PR #109 was rechecked immediately before the product-branch write at preceding head `669f867d3b8ce1ef94aa513e779e64c51ffa606e`; the new commit was then applied with a non-force fast-forward. Final PR reconciliation shows #109 open, draft, mergeable and unmerged at `e83fc37...`.

## Preflight reconciliation for this execution
Mandatory files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

GitHub control was `run_id=b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, `sequence=3`, `status=continue`, `task_id=v1-product-experience-overhaul`. `main` resolved to the sequence-3 coordination checkpoint and PR #109 still resolved to `669f867...`, exactly matching the prior STATE. Therefore the completed dual-Sheet source audit and validated Play/Dice/VFX/Appearance slices were not repeated.

## Work completed in this execution
### Implemented V0.9 dual Character Sheet presentation
Source commit:
- `e83fc37f60b6f42f0ed7b8c76329465ed55e3644`
- message: `Implement V0.9 dual character sheet layouts`

Changed/added production paths:
- `src/CharacterSheetPlayScreen.tsx`
  - small persisted layout router;
  - choices `SimpleVTT Sheet` and `Official sheet layout`;
  - presentation preference remains independent of Character state.
- `src/LegacyCharacterSheetPlayScreen.tsx`
  - exact prior validated SimpleVTT standalone sheet source blob (`3532b3928f5c1155b487faf70b985df2d72f35b9`) retained unchanged rather than rewritten.
- `src/app/sheetLayoutPreferences.ts`
  - storage key `simplevtt.v09.sheet-layout`;
  - default `simplevtt`;
  - safe sanitization and non-blocking storage failure;
  - no Character/mechanics persistence.
- `src/OfficialCharacterSheetPlayScreen.tsx`
  - same `snapshot.activeCharacter` and existing AppProvider edit/level-up/item handlers;
  - local tabletop roll presentation only;
  - reads canonical Official projection, spellcasting projection and action metadata.
- `src/OfficialCharacterSheetPage.tsx`
  - recognizable paper information arrangement as original React UI;
  - Character identity, six abilities, inspiration/proficiency area, saves, complete skills, passive perception, languages/tools, AC/Initiative/Speed, HP/temp HP, Hit Dice, Death Saves region, attacks, resources, equipment/currency, personality/ideals/bonds/flaws/features regions;
  - ability/save/skill/Initiative/attack/damage/Hit Die/item interactions use existing handlers/projections;
  - Player Name, Alignment, XP, unknown Hit Die quantity and Death Save persistence are shown as untracked rather than fabricated.
- `src/OfficialSpellcastingSheetPage.tsx`
  - dedicated level 0–9 paper-layout page;
  - Character/Class, projected spellcasting modifier, Spell Save DC and Spell Attack Bonus;
  - projected current/max slots;
  - known/prepared/always-prepared state;
  - supported local spell attack/damage controls use existing action metadata.
- `src/character-sheet-layouts.css`
  - original SimpleVTT layout styling only; no copied D&D logo/artwork or parchment asset URL.
- `tests/ui/characterSheetPlayableUx.test.ts`
  - same Character authority;
  - persisted layout preference;
  - exact preserved SimpleVTT behavior;
  - Official page information/interactivity;
  - spell levels 0–9/current slots/prepared state;
  - presentation-mechanics separation.

### Architecture preserved
- no second Character store or persistence path;
- no new combat/spell resolver or ResolutionEvent path;
- no new network/content protocol;
- no mechanics arithmetic for Spell Save DC/Attack Bonus moved into the Official screen;
- `projectOfficialSheet`, `sheetAbilityModifier`, `sheetSaveBonus`, `scene.spellcastingByActor` and `scene.actionsByActor` remain the projection/mechanics boundary;
- standalone local dice remain presentation/local tabletop behavior only.

## Validation evidence for exact head `e83fc37...`
### UI
- workflow run: `32176685363`
- frontend job: `95840143821`
- conclusion: **success**
- focused dual-Sheet step `Verify Phase 14 tabletop sheet, physics dice, and intent-first play UX`: **success**.
- `Typecheck and build`: **success**.
- same exact-head job also passed UI named-rule boundary, shell, Play structure/accessibility, Combat VFX, Session/Host/DM regressions, Character ownership/inventory/spell regressions, creation/progression checks, authoritative spellcasting and Phase 09 mechanics services.

This closes the dual Character Sheet slice as a validated boundary. Do not redo it unless later touched.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting presentation.

Historical unchanged evidence remains reusable, including UI run `32171564923` / frontend job `95823699460` and Phase 11 offline walkthrough job `95823700000` at `669f867...`.

## Next Exact Action
1. Perform mandatory watcher preflight; trust GitHub if PR #109 has advanced.
2. If the work head remains `e83fc37...`, do not revalidate or rewrite dual Sheet, Play, Dice, VFX or Appearance.
3. Resume at **direct-IP Session + validated automatic content parity**.
4. Inspect only the Session/network/content paths needed for that slice: production Session workspace/lifecycle/UI state, Tauri session transport, connected protocol/wire/state, installed-content composition and RuleModule validation.
5. Preserve existing Host/session authority. Normal offline Session UX must expose real Host session name + Bind/Listen IP/interface + port + open/start/stop + readable/copyable address, and Join Host IP/address + port + saved Character + Connect/Disconnect/Ready. Do not substitute a fake invite code.
6. Before Client Ready, automatically reconcile Host-required supported declarative content using the existing installed-content/RuleModule authority with normal wording `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`.
7. Reconnect comparison is idempotent and transfers only missing/changed supported packages. Validation/sync failure blocks Ready with an actionable reason. No Host-provided arbitrary JS/native execution, second addon store or second mechanics/content protocol.
8. Add focused tests for direct-IP field reachability/lifecycle wiring/content comparison-transfer-validation/Ready gating/reconnect idempotency and run affected gates first.
9. After Session/content parity is exact-head green, continue Character portrait + DM handout/reconnect, then contextual DM/Content/Rules polish and dead-legacy cleanup.
10. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
11. PR #109 remains draft/unmerged. Never merge without explicit user authorization.

## Architecture invariants
- owning Client Character Library remains durable Character authority; Host projections remain ephemeral;
- Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance/layout preferences are presentation only;
- no second store/protocol/resolver/event ledger, tactical map/Fog/path/minimap/LOS or cloud dependency.

## Coordination writes
- PLAN checkpoint commit on `main`: `a5d3b16d68f5248d9124161972150bf1bbe4356e`.
- STATE is this checkpoint and was written after PLAN.
- control must be written last, remain sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
