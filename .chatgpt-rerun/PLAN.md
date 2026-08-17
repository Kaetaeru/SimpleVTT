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
SimpleVTT v1 launches as one coherent tabletop product. Preserve the canonical Character/content/session/mechanics engines; rebuild launch, global information architecture and routine UX so every production capability is discoverable without repository knowledge or Debug Dock.

Authoritative design:
- `.agents/V1_PRODUCT_EXPERIENCE.md`
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`

## Stable global information architecture
`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

Play, Encounter/Combatants, Activity/history, DM correction and image handouts are contextual tools, not permanent global destinations.

## v1 Definition of Done
One exact source SHA must pass together:
- first-launch Home/title/guide and feature reachability;
- Character create/import/edit/level-up/restart durability;
- standalone physical-table Sheet, direct rolls/resources and durable portrait;
- declarative addon local-file install/preview/validation/restart composition;
- Host/Join/Ready/start/stop/reconnect and empty Encounter preparation;
- intent-first exploration and contextual Initiative combat;
- contextual DM Combatants/adjudication/history and image handout;
- actual WebGL physics dice without changing authoritative connected outcomes;
- full frontend/mechanics/persistence/connected/Windows gates;
- human Windows first-launch/sheet/addon/two-instance acceptance;
- PR stays draft/unmerged until explicit merge authorization.

## First v1 source slice
Current work head: `64cc3b451dfddc40627156db1faa36e109074fa4`.

Implemented:
- `.agents/V1_PRODUCT_EXPERIENCE.md` v1 contract;
- Home/title and dismissible first-use guide;
- stable global v1 shell/navigation and contextual `플레이로 돌아가기`;
- first-class Content/Addons screen using the existing RuleModule importer with local JSON picker, 5MB/type guard, preview/validation/install and supported-addon guide;
- explicit production `CharacterSheetPlayScreen` and `CharacterCreateScreenV10` routes;
- removed hidden Vite route-string rewriting;
- updated v1 and progression structure contracts for explicit source composition;
- temporary shell integration workflow/script removed after source landed.

## Current validation boundary
Exact source `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`, UI `32037896937` / frontend `95411828599`:
- v1 shell contract passed;
- Session, standalone-sheet/physics-dice/intent-play, non-Character UX, Host metadata, live DM continuity, lifecycle/ownership/inventory/spell batch and creation ChoiceDefinition checks passed;
- `Verify progression choice schedule regression` failed; later TypeScript/build steps were skipped.

A temporary diagnostic workflow at current head `64cc3b451dfddc40627156db1faa36e109074fa4` exposed only that its isolated job omitted `npm run generate:content`, producing a missing generated catalog error. That result does **not** explain the normal UI failure because normal UI does generate content first. Do not treat it as product evidence.

## Next Exact Action
1. Instrument the **normal UI workflow's** `Verify progression choice schedule regression` step to capture the test's assertion output after the existing `Generate content dependencies` step, using the same annotation pattern as the frontend build diagnostic.
2. Rerun from a direct-authored work head and read that annotation. Fix only the exact failing assertion/fixture. Do not restore the removed Vite source transform.
3. Delete `.github/workflows/v1-progression-diagnostic.yml` once the normal-workflow diagnostic is available.
4. Obtain an exact-head green UI TypeScript/production build before broadening the slice.
5. Continue v1 implementation in order: Character Library framing → Sheet Initiative/Hit Dice/spell slots/resources → portrait → remaining intent runtime/copy → DM handout transport/viewer/reconnect → contextual Combatants/Activity/adjudication → Rules/Settings cleanup.
6. Targeted test each slice; then one exact-head full UI/Main/connected/persistence/Windows validation and human first-launch + sheet + addon + two-instance acceptance.
7. Keep PR #109 draft/unmerged.

## Architecture preserved
- Owning Client Character Library is durable authority; Host projections remain ephemeral.
- Existing installed-content composition/RuleModule validation is the addon engine.
- Host remains connected mechanics authority; ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/Undo remain canonical.
- Fresh Host remains empty; official Combatants are deliberate and not silently rebalanced.
- No second stores/protocols/mechanics runtime, tactical map/Fog/LOS, or cloud dependency.

## Dispatch recommendation
`continue`
