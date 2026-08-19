# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `continue`

## Watcher execution conventions
- `STATUS.md`와 사람에게 보여 주는 watcher 상태 설명은 **한국어로 작성한다**. 정확한 SHA/workflow/job/code 식별자는 원문을 유지할 수 있다.
- GitHub 작업은 먼저 해당 GitHub 플러그인 스킬을 호출한다. 일반 저장소/PR은 `github`, CI 실패는 `gh-fix-ci`, 리뷰는 `gh-address-comments`, 게시 작업은 `yeet`를 우선한다.
- CI에서 `gh-fix-ci`가 `gh` 부재/인증 문제로 Actions 로그를 읽지 못하면 사용자 승인에 따라 connector `fetch_workflow_job_logs`와 관련 run/job API를 fallback으로 사용할 수 있다.
- 실제 로그/실제 human repro 없이 추측 수정하지 않는다.
- PR #109는 명시적 사용자 승인 없이 merge하지 않는다.

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts remain presentation state only;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency.

## Human acceptance failure that reopened this sequence
The delivered automated-green Windows build at `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994` failed human acceptance with four exact observations:
1. production dice did not match the UI-demo geometry/visual treatment;
2. the reference/demo session could not perform an attack;
3. Character did not visibly expose the official-sheet layout version;
4. different existing Character cards all opened one same Character.

These observations remain the only reopened product scope. Unrelated previously validated boundaries stay closed unless touched.

## Current fix HEAD
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

The product fixes landed by `461f4f62de159fe8d0b4e4fadd4a20340efd1db8`; `d942d58a...` is a subsequent **test-only** alignment commit that removed one stale expectation that d10 must use `CylinderGeometry`.

### Fix 1 — UI-demo-aligned production dice
- `src/PhysicsDice3D.tsx` remains the shared Three.js + cannon-es physics renderer used by sheet/runtime presentation.
- production facets/numerals/light treatment now use the prior UI-demo bronze/warm visual language (`#c77d38`, warm numerals, flat polyhedral facets).
- d10 no longer uses a cylinder/prism mesh; it uses a dedicated ten-face polyhedral geometry helper.
- authoritative results, physics replay, reduced-motion and result-convergence behavior remain presentation-only and unchanged in authority.

### Fix 2 — reference/demo attack is actually playable
- new outer acceptance projection reuses the existing production runtime and existing `runtimeSpatialRelation` facts.
- the reference wolf is at a legal 5 ft melee relation in the offline reference scene, so default Aelar has a real legal longsword target.
- attack `eligibleTargetIds` are projected from existing spatial visibility/range facts rather than presenting out-of-range targets as legal.
- actual attack resolution still goes through the existing authoritative attack transaction/resolution path.

### Fix 3 — official Character Sheet layout is exposed from Character Library
- new `CharacterLibraryUxBridge` mounts into the existing Character Library header.
- it exposes the existing persisted `SimpleVTT 시트 / 공식 시트 스타일` preference before a Character is opened, matching the UI-demo exposure.
- it reuses the existing `CharacterSheetPlayScreen` / `OfficialCharacterSheetPlayScreen`; no second Character representation or mechanics path was created.

### Fix 4 — Character cards select their own canonical Character
- the Character Library bridge maps each rendered regular card to the same-index `snapshot.characters` entry and calls existing `selectProductionCharacter(character.id)`.
- default legacy Mira fixture data is materialized as a distinct playable Character sheet in the existing adapter Character collection so the existing second card is not just an unusable summary.
- existing saved full Characters continue through the same canonical selection path; no second Character store was added.

## Focused regression coverage
- `tests/ui/productionAcceptanceWindowsRegression.test.ts` verifies the reference demo has a legal melee target and completes the attack through the authoritative runtime, and verifies Mira/Aelar select as distinct Characters.
- `tests/ui/productionLocalCharacterSwitch.test.ts` verifies distinct reference Character selection plus existing remote SessionProjection preservation.
- `tests/ui/characterSheetPlayableUx.test.ts` verifies Character Library official-layout exposure while preserving the existing dual-sheet authority.
- dice structure tests verify the UI-demo bronze visual language, polyhedral d10, shared WebGL physics renderer and no `CylinderGeometry` regression.
- UI workflow now runs these human-acceptance regressions.

## CI evidence at current exact HEAD `d942d58a...`
Completed success:
- UI run `32204865620`, frontend job `95926003383`: **success**. This includes the four human-acceptance regressions, Character/session integration, Phase 09 mechanics suite, TypeScript and production build.
- Rules Domain `32204865592`: **success**.
- Contract validation `32204865594`: **success**.
- Persistence `32204865644`:
  - application-contract `95926003457`: **success**;
  - tauri-storage `95926003360`: **success**.
- Main Playable `32204865588`, playable-contract `95926017359`: **success**, including full UI/rules/TypeScript/frontend, offline, connected, SessionProjection, DM prepared/live, Undo and accessibility contracts.
- Phase 11 `32204865635`, offline-walkthrough `95926003264`: **success**.
- Phase 12 `32204865632`, connected-protocol `95926003189`: **success**.

Still running at checkpoint; do not restart them merely due watcher continuation:
- Main Windows `95926276820`: in progress after setup/dependencies, currently Tauri persistence/session transport verification then Windows executable build/stage/upload.
- Phase 11 Windows `95926114975`: in progress building Windows playable executable.
- Phase 12 Windows connected `95926150169`: in progress at Tauri session transport/persistence verification before executable build/stage/upload.

### CI diagnosis note
At intermediate source HEAD `461f4f62...`, all new human-acceptance regressions already passed. UI later failed only because the older `tests/ui/visualDiceStructure.test.ts` still asserted `/CylinderGeometry/`. `gh-fix-ci` was invoked first and the approved connector log fallback proved that single stale assertion. `d942d58a...` changes only that duplicate test expectation to the new polyhedral d10 requirement; current UI is fully green.

## Previously validated boundaries — do not repeat unless touched
1. Production Play.
2. Composable Combat VFX.
3. Appearance preferences.
4. Direct-IP Session entry/configuration.
5. Automatic Host-required declarative content parity before Ready.
6. Character portrait + DM image handout/reconnect.
7. Contextual DM/Content polish + production dead-wiring cleanup.
8. Proven-unreachable legacy `App.tsx` cleanup plus named-rule baseline alignment.

Dice presentation, demo attack, dual-sheet exposure and Character-card selection were deliberately reopened by human acceptance and are being revalidated at `d942d58a...`.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch or PR #109 moved.
2. If work HEAD remains `d942d58a...`, **do not repeat source investigation or already-green UI/Linux/application gates**.
3. Re-fetch the three already-running Windows jobs above; do not manually rerun them.
4. If any Windows job fails, invoke `gh-fix-ci` first, then use the user-authorized connector log fallback if `gh` is unavailable; fix only the observed failure.
5. Once Main Windows `95926276820` succeeds with build/stage/upload, fetch run `32204865588` artifact for exact HEAD `d942d58a...`, download it and deliver the executable/ZIP to the user.
6. Prefer also recording Phase 11/Phase 12 Windows success if they complete in the same exact-head set; they are already running.
7. Set control to `needs_user` only after the exact-head playable artifact is available, because the four original observations require another human Windows acceptance pass.
8. On retest, ask the user to verify exactly: dice appearance, demo attack, official sheet layout, and distinct Character-card selection. Do not mark V0.9 complete until that human pass succeeds.
9. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
