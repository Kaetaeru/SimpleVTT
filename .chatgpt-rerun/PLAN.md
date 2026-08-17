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

## v1 product goal
SimpleVTT v1 must launch as a coherent tabletop product rather than a collection of development surfaces. Existing Character persistence, installed-content composition, connected authority, Scene/runtime mechanics, ResolutionEvent history/Undo and reconnect/idempotency remain canonical; the product shell, information architecture and routine UX are being rebuilt around them.

Authoritative design:
- `.agents/V1_PRODUCT_EXPERIENCE.md`
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`

## Stable v1 information architecture
Global destinations:
1. 홈
2. 캐릭터
3. 세션
4. 콘텐츠
5. 규칙
6. 설정

Play, Encounter/Combatants, Activity/history, DM correction and image handouts are contextual tools rather than permanent global tabs.

## v1 Definition of Done
One exact source SHA must pass together:
- first-launch Home/title and first-use guidance;
- Character create/import/edit/level-up/restart durability;
- standalone physical-table Sheet with direct ability/save/skill/Initiative/attack/damage/common-die rolls, Hit Dice, spell slots/resources and portrait;
- declarative addon local-file install/preview/validation/restart composition;
- named Host/Join/Ready/start/stop/reconnect and empty Encounter preparation;
- quiet intent-first exploration and contextual Initiative combat;
- contextual DM adjudication/Combatants/history without permanent debug panels;
- DM image handout reveal/withdraw + Client dismiss/reopen/reconnect convergence;
- actual WebGL physics d4/d6/d8/d10/d12/d20 without changing Host-authoritative outcomes;
- full TypeScript/frontend/mechanics/persistence/connected regression gates;
- exact-head Windows artifact and human Windows first-launch/sheet/addon/two-instance acceptance;
- PR stays draft/unmerged until explicit authorization.

## First v1 implementation slice completed in source
Current source checkpoint: `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`.

Implemented:
- `.agents/V1_PRODUCT_EXPERIENCE.md` with complete v1 IA, reachability matrix and DoD;
- `V1HomeScreen`: SimpleVTT title/Home, first-use guide, new/open Character, Host/Join, addon and Rules entry points, returning session/content context;
- stable global shell `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정` with contextual `플레이로 돌아가기`;
- `V1ContentScreen`: local JSON file picker, 5MB/type guard, existing RuleModule package preview/validation, explicit install, installed-content summary and embedded addon-authoring guide;
- production `AppRoute` includes Home/Content and launches at Home;
- production Character Sheet route is explicitly `CharacterSheetPlayScreen`;
- production Character Create route is explicitly `CharacterCreateScreenV10`;
- removed the legacy Vite `simplevtt-character-progression-routes` source-string transform so build/runtime composition no longer changes behind the source code;
- updated progression regression to assert explicit LevelUp host/bridge composition rather than the removed Vite transform;
- removed the temporary one-shot v1 integration script/workflow after the source patch landed;
- v1 product-shell structural test is part of UI CI.

## Validation evidence and current gate
Earlier v1 UI runs showed:
- new v1 product-shell tests green;
- Phase 14 session/player-experience/mechanics UI suites green through the progression boundary;
- initial build failure root-caused to the obsolete Vite source-string transform, which has now been removed;
- the next failure was the old progression regression asserting that obsolete transform; that regression has now been rewritten to the real source-composition contract.

A fresh direct-authored exact-head validation was triggered at `24a228d3418d1de553fa2b5749351cdf0f2ab3cd` after deleting the temporary Actions integration workflow, specifically to avoid GitHub `action_required` results on workflow-authored commits.

Do not claim the first slice fully green until that exact-head UI/build run completes successfully.

## Architecture preserved
- Owning Client Character Library remains the durable Character source; Host projections remain ephemeral.
- Existing installed-content store/composition and RuleModule validation are the addon engine; no arbitrary executable-plugin engine is introduced.
- Host remains connected mechanics authority.
- Existing connected ledger, reconnect/idempotency, Scene runtime, ResolutionEvent history and event-native Undo remain canonical.
- Fresh Host remains empty-by-default; official Combatants are deliberate and not silently UI-rebalanced.
- No tactical grid/token/Fog-of-War/path/LOS or cloud-account dependency.

## Next Exact Action
1. Read exact-head UI run for `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`. If it fails, repair only the reported boundary; if green, record it and continue without repeating unchanged mechanics tests manually.
2. Reframe Character Library inside the v1 product shell while preserving existing create/import/edit/level-up engines.
3. Complete standalone Sheet gaps: Initiative direct roll, Hit Dice/spell-slot/resource operation, then durable portrait editor/persistence.
4. Complete intent-action runtime coverage and remove remaining implementation/debug copy from production Play.
5. Implement DM image handout presentation state/transport/viewer/reconnect without making it ResolutionEvent state or a permanent panel.
6. Fold Combatants/Activity/adjudication into contextual DM/session flows and remove their legacy product-global framing.
7. Rework Rules and Settings to the v1 information hierarchy; Content owns addon installation.
8. Run targeted tests for each slice, then one exact-head full UI/Main/connected/persistence/Windows validation and human acceptance.
9. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
