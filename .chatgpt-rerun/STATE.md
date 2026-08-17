# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Scope transition
The user explicitly promoted the work from the previous Phase 14 screen-specific redesign to a full **SimpleVTT v1 product experience overhaul**. Existing validated engines are preserved; product shell, information architecture and user-facing composition are being rebuilt so every supported production capability is discoverable from a normal launch path.

Sequence advanced from 1 to 2. The run_id remains unchanged so historical validation and architecture decisions remain attached to the same durable workstream.

## Authoritative design
Work-branch document `.agents/V1_PRODUCT_EXPERIENCE.md` now defines:
- v1 Home/title/first-use entry;
- stable global navigation;
- Character/tabletop-sheet journey;
- Contents/Addons journey using the existing installed-content architecture;
- Session lifecycle;
- intent-first exploration/combat and contextual DM tools;
- Character portrait and DM image-handout requirements;
- real physics 3D dice requirements;
- feature reachability matrix;
- single-exact-SHA v1 Definition of Done.

The prior `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` remains detailed source material for physics dice, standalone sheet, image and play requirements.

## Work completed in the first v1 slice
On `agent/108-production-play-session-ux`:
- added `src/V1HomeScreen.tsx`;
- added `src/V1ContentScreen.tsx`;
- added `src/v1-product-shell.css` and token compatibility rules;
- added `tests/ui/v1ProductShellStructure.test.ts`;
- added `scripts/apply-v1-product-shell.mjs` and a temporary integration workflow for exact-boundary edits to the large existing App shell;
- `src/App.tsx` now launches at route `home` and mounts v1 Home/Content screens;
- `AppRoute` now includes `home` and `content`;
- global product navigation is now `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정` instead of separate Player/DM global nav sets;
- live session exposes contextual `플레이로 돌아가기` rather than making Play/Combatants/Activity permanent product-global destinations;
- Home exposes new/open Character, Host/Join, Addon and Rules paths plus a dismissible/reopenable first-use guide;
- Content/Addons exposes a local `.json` file picker, 5MB guard, package preview, existing structural/semantic validation, explicit install action, installed local-content summary and an embedded guide for the supported declarative RuleModule package format;
- CI now runs the v1 product-shell structure contract and emits useful frontend build failure annotations.

## Existing functionality being carried into v1
The branch already contains in-progress Phase 14 player-experience work:
- Three.js + Cannon-based physics dice path for d4/d6/d8/d10/d12/d20;
- standalone interactive Character Sheet direct rolls;
- intent-first `ProductionPlayScreen` based on official action intents;
- existing Session scroll/lifecycle/empty-Encounter repair;
- validated authoritative runtime, Character ownership, persistence and connected-session mechanics.

These are implementation assets, not yet the final v1 acceptance SHA.

## Current validation evidence
UI run `32037168487`, frontend job `95409834174`, head `62f004e7fe07c99804fa5ec2a22470e6132fde71`:
- v1 product-shell structure contract: success;
- all preceding Phase 14 UI/session/player-experience/mechanics structure tests: success;
- creation/progression/class/spell regressions: success;
- Phase 09 mechanics suite: success;
- final TypeScript/production build step: failure.

The UI workflow was then changed to emit the build tail as an explicit annotation so the compile error can be fixed exactly. Current work head has advanced beyond `62f004e7...`; fetch PR/head before any subsequent code write.

## Preserved architecture
- Owning Client Character Library remains the durable Character source; Host projections remain ephemeral.
- Host remains connected mechanics authority.
- Installed-content persistence/composition and RuleModule validation remain the addon engine.
- Existing connected ledger, reconnect/idempotency, Scene runtime, ResolutionEvent history and event-native Undo remain canonical.
- No second stores/protocols/mechanics runtimes were introduced.
- No tactical map/grid/token/Fog-of-War/path/LOS or cloud-account dependency was introduced.
- Fresh Host remains empty-by-default; official Combatants are deliberately added and their source statistics are not silently UI-rebalanced.

## Next Exact Action
1. Fetch the latest UI run for the current work head and read the new TypeScript/build annotation.
2. Fix only the reported compile/build boundary and obtain an exact-head green UI gate.
3. Continue the v1 slices in order:
   - v1 Character Library/product framing;
   - standalone Sheet Initiative/Hit Dice/spell-slot/resource operation;
   - durable portrait/editor;
   - remaining intent action runtime coverage/copy cleanup;
   - DM handout presentation state/transport/viewer/reconnect;
   - contextualize Combatants/Activity/adjudication and remove product-global duplication;
   - v1 Rules/Settings cleanup.
4. Validate targeted boundaries after each slice and preserve existing mechanics/persistence/connected regressions.
5. Only after one exact SHA is green, build/verify Windows and run human first-launch + sheet + addon + two-instance Host/Client/image acceptance.
6. PR #109 remains draft/unmerged.

## Dispatch recommendation
`continue`
