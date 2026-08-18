# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
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

PR #109 was rechecked before the implementation write and resolved to the preceding exact head; the branch was then fast-forwarded to `669f867d3b8ce1ef94aa513e779e64c51ffa606e`. No force update was used. PR remains open, draft and unmerged.

## Durable product reference
- `.agents/V0_9_PRODUCT_REFERENCE.md`
- reference commit: `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

The interactive HTML prototypes remain visual/interaction references only. Production work continues in canonical React/runtime architecture and does not transplant their state model or shell.

## Work completed in this execution
### 1. Reconciled stale Rerun checkpoint with GitHub
Mandatory files were read from `main` in the required order:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

`run_id`, `sequence=2`, `task_id` and `continue` were consistent. GitHub showed PR #109 at the VFX exact head `25d9fb38c1e6b595a8e33a58c30d32e4d44510bf` while STATE/PLAN still pointed at the earlier reference-only head.

### 2. Closed the pending Combat VFX validation
At exact head `25d9fb38c1e6b595a8e33a58c30d32e4d44510bf`:
- UI run `32169692783`: success;
- frontend job `95817601546`: success;
- the dedicated step `Verify V0.9 combat VFX projection and presentation boundaries`: success;
- Rules Domain, Contract validation, Persistence, Phase 11 Playable and Phase 12 Connected Session were also green for that head.

This makes the previously pending VFX slice a validated boundary. Do not redo it unless later touched.

### 3. Implemented V0.9 Appearance
Single source commit on the work branch:
- `669f867d3b8ce1ef94aa513e779e64c51ffa606e`
- message: `Implement persisted V0.9 appearance preferences`

Files added/changed:
- `src/app/appearancePreferences.ts`
  - pure presentation preference model;
  - Dark/Light mode + hex accent;
  - curated swatches;
  - safe parsing/sanitization;
  - local restart persistence through `simplevtt.v09.appearance`;
  - startup apply function;
  - storage failure is non-blocking and never mechanics state.
- `src/AppearanceSettingsBridge.tsx`
  - production Settings bridge using the same portal/bridge integration pattern already used elsewhere in the app;
  - Dark/Light controls;
  - curated accent swatches;
  - custom `<input type="color">`;
  - keyboard/ARIA pressed state;
  - reconciles the still-present legacy Settings local theme effect so persisted preferences remain authoritative.
- `src/appearance-settings.css`
  - mode-aware derived `--accent` from persisted `--accent-base`;
  - dynamic primary action/focus/highlight treatment;
  - preserves semantic good/bad/info variables rather than redefining them;
  - hides the old fixed Theme/Accent controls from normal Settings reading path while retaining existing motion controls.
- `src/main.tsx`
  - applies persisted appearance before root render;
  - mounts `AppearanceSettingsBridge`;
  - loads appearance CSS last in the shell styling chain.
- `tests/ui/v1ProductShellStructure.test.ts`
  - verifies restart persistence and sanitization;
  - verifies startup-before-render application;
  - verifies presets + custom color + ARIA state;
  - verifies no Parchment/Crimson theme restoration;
  - verifies appearance CSS does not redefine semantic state colors.

No mechanics, Character durability, session authority, ResolutionEvent, content protocol or dice authority code was changed by the Appearance slice.

## Validation evidence for current exact head
Current exact head:
`669f867d3b8ce1ef94aa513e779e64c51ffa606e`

### UI
- run: `32171564923`
- frontend job: `95823699460`
- conclusion: **success**
- passed:
  - UI named-rule boundary;
  - V0.9 product shell + Appearance persistence contract;
  - Play structure/accessibility;
  - Combat VFX projection/presentation boundary;
  - existing Phase 14 session/DM/player regressions;
  - progression regressions;
  - Phase 09 real mechanics services;
  - TypeScript and production build.

### Phase 11 Playable
- run: `32171564939`
- `offline-walkthrough` job `95823700000`: **success**
- includes the production-composed offline walkthrough and full production frontend gate.
- Windows job `95823900153` was still building at checkpoint time. It is not yet final V0.9 Windows acceptance evidence and was not required to advance this targeted source slice.

## V0.9 slices now validated; do not repeat unless touched
1. Production Play
   - one top Initiative strip;
   - NPC/hostile above, party below;
   - no permanent Play sidebars;
   - bottom ActiveActorPanel/ResourceRail/icon Hotbar/context chooser/End Turn;
   - canonical action and Freeform boundaries preserved.
2. Fast production Visual Dice
   - depth-forward WebGL/physics presentation;
   - <=1.5 s cadence;
   - slot result notice + formula expansion;
   - semantic Natural 20 / Natural 1;
   - no connected mechanics authority change.
3. Composable Combat VFX
   - presentation-only delivery + element projection;
   - no hidden defense leakage;
   - no mechanics mutation.
4. Appearance
   - independent Dark/Light + accent;
   - curated + custom accent;
   - restart persistence;
   - semantic colors preserved.

Historical unchanged evidence remains valid and should not be rerun just because Rerun restarted:
- progression fixture repair `1d0a132f2941b131451e5a98715a2088d614fd42`;
- clean UI baseline `25c767893583da1809aa06bc0c875c14b8602154`;
- UI run `32162614993`, frontend job `95769907698`;
- old desktop-guide head `3a2c83541857591ecb30aa03aa0a6285e23b7677`, UI run `32163607516`, frontend job `95797936721`.

## Next Exact Action
1. Read `.agents/V0_9_PRODUCT_REFERENCE.md` from `agent/108-production-play-session-ux` before new code changes.
2. Resume at the next incomplete V0.9 slice: **dual Character Sheet presentation**.
3. Inspect current `CharacterSheetPlayScreen`, Character projection/state, Character Library entry flow, spell/resource projection and existing local roll handlers.
4. Add one presentation preference over the same canonical Character:
   - SimpleVTT Sheet;
   - true paper-layout Official sheet layout;
   - persisted default layout preference only, never a second Character store.
5. Implement the Official layout as interactive React UI using the same existing roll/resource/item handlers. Follow the real paper information arrangement rather than applying parchment styling to the digital dashboard.
6. Add dedicated Official Spellcasting page with level 0–9 sections, spellcasting summary, slot state, known/prepared state and supported spell actions over the same canonical data.
7. Add focused tests for shared Character identity/state, layout preference persistence, Official-mode interactivity, spell level 0–9 structure and absence of new mechanics arithmetic in presentation code.
8. Run affected UI/frontend gates first. Do not repeat validated Play/Dice/VFX/Appearance or historical mechanics/persistence/network work unless the dual-Sheet changes actually touch those boundaries.
9. After dual Sheet is green, continue:
   - direct-IP Session + validated automatic content parity;
   - portrait + DM handout/reconnect;
   - contextual DM/Content/Rules polish and dead-legacy cleanup.
10. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation and human Windows acceptance for V0.9.
11. PR #109 remains draft/unmerged. Never merge without explicit user authorization.

## Architecture preserved
- owning Client Character Library is durable Character authority; Host projections are ephemeral;
- Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains mechanics path;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance are presentation only;
- fresh Host remains empty and official Combatants are not silently rebalanced;
- no second store/protocol/resolver/event ledger, tactical map/Fog/path/minimap/LOS or cloud dependency.

## Coordination writes
- PLAN checkpoint commit on `main`: `fb1e8079e872888fd7b3c34c7479b9decd307b11`
- STATE is this checkpoint.
- control must remain `continue` and is written last.

## Dispatch recommendation
`continue`
