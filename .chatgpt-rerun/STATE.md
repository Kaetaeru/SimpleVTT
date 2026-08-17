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

## Current source checkpoint
`24a228d3418d1de553fa2b5749351cdf0f2ab3cd`

## v1 scope
The task is now the full SimpleVTT v1 product experience. Existing validated engines remain canonical; the launch experience, global IA and routine Character/Content/Session/Play/DM composition are being rebuilt so all supported production capabilities are reachable from normal UI.

Authoritative product contract:
- `.agents/V1_PRODUCT_EXPERIENCE.md`
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`

## First v1 slice now in source
- App launches at a SimpleVTT Home/title surface.
- Home exposes new/open Character, Host/Join, addon install and Rules entry points plus dismissible first-use guidance.
- Global nav is `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`; Play is contextual via `플레이로 돌아가기` during live sessions.
- Added first-class `콘텐츠 · 애드온` screen using the existing installed-content/RuleModule engine: local JSON picker, bounded file-size/type handling, package preview, dependency/conflict/capability validation, explicit install and addon-authoring guidance.
- Production Character Sheet route explicitly uses `CharacterSheetPlayScreen`.
- Production Character Create route explicitly uses `CharacterCreateScreenV10`.
- Removed the obsolete Vite `simplevtt-character-progression-routes` string-transform plugin. Production route composition is now visible in source instead of silently rewritten at build time.
- Updated the LevelUp regression contract to preserve the existing `LevelUpScreen` host + `LevelUpV10Bridge` without requiring the removed Vite transform.
- Temporary Actions integration script/workflow were removed after the source patch landed.

## Validation evidence
### Historical first-v1 runs
The new v1 shell contract, Phase 14 Session/standalone-sheet/physics-dice/intent-play contracts, production lifecycle/mechanics checks and creation ChoiceDefinition checks have repeatedly passed on the new source family.

Initial final-build failure was root-caused to the obsolete Vite string-transform plugin. That plugin is now removed.

### Current exact-head UI run
Head: `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`
UI run: `32037896937`
frontend job: `95411828599`

Passed before the current stop point:
- UI named-rule boundary;
- v1 product-shell entry contract;
- PlaySessionDock structure;
- production play accessibility structure;
- unified production Session UX;
- tabletop sheet / physics dice / intent-first play UX;
- non-Character production UX regression;
- Host preparation metadata;
- live DM mechanics continuity;
- Phase14 production lifecycle/prepared/live/local ownership/fresh Character/inventory/spell batch;
- creation ChoiceDefinition convergence.

Current failure is isolated at `Verify progression choice schedule regression`; later steps are skipped, so exact-head TypeScript/build is not yet green. The test was changed from asserting the old Vite rewrite to asserting source-level LevelUp host/bridge composition, but the workflow currently does not surface that step's assertion output. Do not guess at the remaining assertion.

## Architecture preserved
- Owning Client Character Library remains durable Character authority; Host projections remain ephemeral.
- Existing installed-content persistence/composition and declarative RuleModule validation remain the addon engine.
- Host remains connected mechanics authority.
- Existing ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/event-native Undo remain canonical.
- Fresh Host remains empty by default; official Combatants are deliberately added and not silently rebalanced by UI.
- No second Character/content/mechanics/session stores and no tactical map/grid/token/Fog-of-War/path/LOS/cloud dependency were introduced.

## Next Exact Action
1. Make `Verify progression choice schedule regression` emit its failing assertion/output to a GitHub annotation (same diagnostic pattern already used for the final build), then rerun only through the normal UI gate.
2. Fix only the exact regression assertion/fixture identified there. Do not restore the removed Vite source transform.
3. Obtain an exact-head green UI TypeScript/production build before broadening the implementation slice.
4. Continue v1 implementation in this order:
   - Character Library v1 framing;
   - standalone Sheet Initiative / Hit Dice / spell-slot / resource operations;
   - Character portrait persistence/editor;
   - remaining intent-action runtime coverage and production-copy cleanup;
   - DM image handout presentation state/transport/viewer/reconnect;
   - contextual Combatants/Activity/adjudication;
   - v1 Rules/Settings cleanup.
5. Run targeted regression after each slice, then one exact-head full UI/Main/connected/persistence/Windows validation and human first-launch + sheet + addon + two-instance acceptance.
6. PR #109 remains draft/unmerged.

## Dispatch recommendation
`continue`
