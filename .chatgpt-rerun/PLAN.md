# Rerun Plan — SimpleVTT v1

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `2`
- task_id `v1-product-experience-overhaul`
- dispatch recommendation: `continue`

## Why the task advanced
The user explicitly broadened the prior Phase 14 play/session redesign into the SimpleVTT **v1 product experience**. The goal is no longer to repair isolated production screens. The application must launch as a coherent product whose supported capabilities are all discoverable and usable from normal UI, from the title/Home screen through Characters, addons/content, sessions and actual play.

This is a new top-level execution boundary, so sequence advances from 1 to 2 while preserving the same repository/run history.

## Authoritative product design
- `.agents/V1_PRODUCT_EXPERIENCE.md` on the work branch is the v1 UX/IA/Definition-of-Done contract.
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` remains the detailed source for physics dice, standalone sheet, intent-first play, Character portrait and DM image-handout requirements.
- `.agents/PHASE14_PRODUCTION_UX_REDESIGN.md` remains historical rationale for the Session/non-Character cleanup.

## Architecture that must survive the UI rewrite
- Existing Character Library persistence and owning-Client Character authority remain canonical.
- Host Character projections remain ephemeral.
- Existing installed-content composition/persistence and RuleModule package validation remain the addon/content engine.
- Existing Host connected-session authority, ledger, reconnect/idempotency and protocol remain canonical.
- Existing Scene/runtime mechanics, ResolutionEvent history, event-native Undo, attacks/saves/damage/healing/items/spells/concentration/reactions/effects/turn lifecycle remain canonical.
- No second Character store, content catalog, mechanics resolver, event ledger or connected-session protocol.
- No tactical grid/token/Fog-of-War/pathfinding/LOS or cloud-account dependency in v1.
- Official monster statistics/encounter source data are not silently rebalanced by the UI. Fresh Host still starts empty and adds intended Combatants deliberately.

## v1 information architecture
Stable global destinations:
1. `홈`
2. `캐릭터`
3. `세션`
4. `콘텐츠`
5. `규칙`
6. `설정`

`플레이`, Encounter/Combatants, Activity/history, DM adjudication and image handouts are contextual session tools, not permanent global tabs.

## Required product journeys
### Launch / Home
- SimpleVTT title and concise first-use guidance.
- Obvious entry points for new/open Character, Host/Join, addon install and Rules.
- Returning Home shows only useful current Character/session/content context.

### Character / physical-table sheet
- Character Library, create/import/edit/level-up and restart durability.
- Standalone Character Sheet usable without a Scene.
- Ability/save/skill/Initiative/attack/damage/common-die rolls.
- Hit Dice, spell slots and normal resources usable from the Sheet.
- Durable Character portrait with preview/crop/replace/remove and offline/restart safety.

### Content / addons
- Existing declarative installed-content architecture becomes the v1 addon system.
- Local JSON file picker is the primary install path; raw JSON text is advanced only.
- Preview/validation/dependency/conflict/capability review before explicit install.
- Installed content is visible and composed into Rules/creation/runtime where supported.
- `애드온 만드는 방법` accurately describes the currently supported RuleModule package boundary and never implies arbitrary executable plugins are supported.

### Session
- Offline Host + Join always reachable.
- Session name, address, Character, Ready, empty Encounter prep, mode Start/Stop/reconnect.
- Reliable viewport scrolling and recoverable connection errors.

### Play
- Exploration/freeform is quiet and intent-first.
- Official actions are primary intents; relevant skill/item/weapon/spell/target is chosen second.
- Initiative adds round/turn/order/economy/target information only when needed.
- DM tools are contextual and compact.
- Routine play does not restore permanent Inspector/Activity/entity/image/debug panels.

### Images and dice
- WebGL physics d4/d6/d8/d10/d12/d20 shared across Sheet/runtime-visible rolls; connected animation never changes authoritative results.
- Character portrait follows owning-Character persistence.
- DM local image preview/reveal/withdraw to connected Clients; Client dismiss/minimize/reopen and reconnect convergence; no cloud URL requirement; presentation state only.

## v1 Definition of Done
One exact source SHA must pass all of these together:
1. Fresh Windows first-launch user can discover Character, Host, Join, Addon and Rules paths without repository knowledge.
2. Standalone Sheet physical-table workflow, portrait, direct rolls/resources and restart durability pass.
3. Addon file install/review/validation and restart composition pass.
4. Named Host/Join/Ready/freeform/initiative/reconnect/end/restart and empty Encounter pass in two Windows instances.
5. Intent-first exploration and contextual combat/DM UX pass at common and constrained viewports/keyboard-only/reduced-motion.
6. DM image reveal/withdraw/dismiss/reopen/reconnect pass.
7. Physics dice are real meshes/physics and never override Host-authoritative game results.
8. Existing mechanics/persistence/connected authority regressions remain green.
9. TypeScript/production build and exact-head Windows artifact digest/contents verification pass.
10. Human Windows acceptance passes the same exact SHA.
11. PR #109 remains draft/unmerged until explicit authorization.

## Current implementation slice
The v1 work has started on the existing work branch instead of discarding validated engines.

Implemented/in progress:
- authoritative `.agents/V1_PRODUCT_EXPERIENCE.md`;
- v1 launch/Home surface with first-use guide and Character/Session/Addon/Rules entry points;
- stable global shell/navigation `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`;
- contextual `플레이로 돌아가기` when a live session exists;
- first-class `콘텐츠 · 애드온` screen using the existing installed-content importer with local JSON file selection, size/type guard, package preview, validation, explicit install and an embedded supported-package guide;
- v1 product-shell structure test added to UI CI;
- existing Phase 14 physics-dice/standalone-sheet/intent-play implementation remains the starting point for the next slices.

## Validation state
- The first v1 product-shell structure contract is green in UI automation together with the previously validated UI/mechanics suites.
- The first compilation pass exposed a TypeScript/build-only failure after all preceding UI/mechanics checks passed. CI now emits the frontend build tail as an annotation so the exact compile error can be repaired rather than guessed.
- Do not claim v1 source completion or human acceptance yet.

## Next Exact Action
1. Read the latest UI build annotation for the current v1 head and fix only the compile/build error until the exact-head UI gate is green.
2. Replace the remaining legacy Character Library/product framing with v1 composition while preserving Character creation/progression mechanics.
3. Complete standalone Sheet gaps: Initiative interaction, Hit Dice/spell slots/resource operation, portrait persistence/editor.
4. Complete intent action runtime coverage and remove remaining implementation copy from Play.
5. Add contextual DM handout presentation state/transport and Client viewer/reconnect projection.
6. Fold Combatants/Activity/adjudication into contextual DM/session flows and remove them as product-global concepts.
7. Rework Rules and Settings to the same v1 visual/information hierarchy and remove duplicated content-install entry from Rules.
8. Run targeted UI tests after each slice; then full UI/Main/connected/persistence exact-head validation.
9. Build Windows artifact only after automated v1 gates are green, then perform human first-launch + standalone-sheet + addon + two-instance Host/Client acceptance.
10. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
