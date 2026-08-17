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

## Current work head
`64cc3b451dfddc40627156db1faa36e109074fa4`

## Scope
The user promoted the prior Phase 14 work to a full SimpleVTT v1 product experience overhaul. Existing validated Character persistence, installed-content composition, connected authority, Scene/runtime mechanics, ResolutionEvent history/Undo and reconnect/idempotency remain canonical. Product shell, information architecture and routine UX are being rebuilt around them.

## First v1 slice implemented
- Added authoritative `.agents/V1_PRODUCT_EXPERIENCE.md`.
- App now launches at a SimpleVTT Home/title surface with first-use guidance.
- Home exposes new/open Character, Host/Join, addon install and Rules entry points.
- Global navigation is stable: `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`.
- Live sessions expose contextual `플레이로 돌아가기` instead of permanent Play/Combatants/Activity global tabs.
- Added `V1ContentScreen` using existing installed-content/RuleModule architecture: local JSON file picker, 5MB/type guard, preview, dependency/conflict/capability validation, explicit install, installed-content summary, and supported-addon authoring guide.
- Production Character Sheet is explicitly `CharacterSheetPlayScreen`.
- Production Character Create is explicitly `CharacterCreateScreenV10`.
- Removed the old Vite `simplevtt-character-progression-routes` source-string transform; production composition is now explicit source code.
- Progression structure regression was moved away from requiring that hidden transform.
- Temporary one-shot shell integration workflow/script were removed after source integration.

## Validation
Exact source `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`:
- UI run `32037896937`, frontend `95411828599`.
- Passed: named-rule, v1 shell, PlaySessionDock, production accessibility, unified Session, standalone sheet/physics dice/intent play, non-Character UX, Host prep metadata, live DM continuity, lifecycle/prepared/live/local ownership/fresh Character/inventory/spell batch, creation ChoiceDefinition.
- Failed at `Verify progression choice schedule regression`; later steps including final TypeScript/build were skipped.

Temporary diagnostic head `64cc3b451dfddc40627156db1faa36e109074fa4` ran isolated workflow `32038026064` / `95412195556`, but that workflow omitted `npm run generate:content` and therefore failed on missing `src/generated/progressionCatalog.generated.json`. This diagnostic is inconclusive for the real UI failure because the normal UI workflow already generates content before the test.

## Next Exact Action
1. Modify the normal `.github/workflows/ui.yml` progression-regression step to capture its test output into a GitHub annotation after the existing content-generation step.
2. Run from a direct-authored work head, read the exact failing assertion, and fix only that assertion/fixture. Do not restore Vite source rewriting.
3. Remove temporary `.github/workflows/v1-progression-diagnostic.yml` after the normal diagnostic is available.
4. Obtain exact-head green UI including TypeScript/production build.
5. Continue v1 slices: Character Library framing; Sheet Initiative/Hit Dice/spell slots/resources; portrait persistence/editor; intent runtime/copy; DM handout presentation transport/viewer/reconnect; contextual Combatants/Activity/adjudication; Rules/Settings cleanup.
6. Then full exact-head UI/Main/connected/persistence/Windows validation and human first-launch + standalone-sheet + addon + two-instance acceptance.
7. PR #109 remains draft/unmerged.

## Architecture preserved
- Owning Client Character Library remains durable authority; Host projections ephemeral.
- Existing installed-content store/composition and declarative RuleModule validation remain addon authority.
- Host remains connected mechanics authority; existing ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/event-native Undo remain canonical.
- Fresh Host remains empty by default and official Combatants are not silently UI-rebalanced.
- No second store/protocol/mechanics engine, tactical-map/Fog/LOS, or cloud dependency introduced.

## Dispatch recommendation
`continue`
