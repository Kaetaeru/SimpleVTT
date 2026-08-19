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
- dispatch recommendation: `needs_user`

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
- shared `PhysicsDice3D` uses the prior UI-demo bronze/warm facet language.
- d10 uses dedicated ten-face polyhedral geometry instead of `CylinderGeometry`.
- authoritative-result convergence remains presentation-only.

### Fix 2 — reference/demo attack is playable
- reference wolf has a legal 5 ft melee relation for default Aelar.
- target eligibility reuses existing `runtimeSpatialRelation` visibility/range facts.
- attack resolution remains on the existing authoritative transaction/resolution path.

### Fix 3 — official Character Sheet layout exposure
- `CharacterLibraryUxBridge` exposes the existing persisted `SimpleVTT 시트 / 공식 시트 스타일` preference before opening a Character.
- existing `CharacterSheetPlayScreen` / `OfficialCharacterSheetPlayScreen` remain two presentations over one active Character.

### Fix 4 — Character cards select their own canonical Character
- regular Character cards map to their corresponding `snapshot.characters[index].id` and call existing `selectProductionCharacter(character.id)`.
- reference Mira is materialized as a distinct playable Character in the existing collection; no second store exists.

## Focused regression coverage
- `productionAcceptanceWindowsRegression.test.ts`: legal reference melee attack resolves through authoritative runtime; Mira/Aelar selection is distinct.
- `productionLocalCharacterSwitch.test.ts`: distinct reference Character selection plus remote SessionProjection preservation.
- `characterSheetPlayableUx.test.ts`: Character Library official-layout exposure and existing dual-sheet authority.
- dice structure tests: UI-demo bronze visual language, polyhedral d10, shared WebGL physics renderer, no `CylinderGeometry` regression.

## Exact-head automated validation at `d942d58a...`
Completed success:
- UI run `32204865620`, frontend `95926003383`: **success**, including human-acceptance regressions, Character/session integration, Phase 09 mechanics, TypeScript and production build.
- Rules Domain `32204865592`: **success**.
- Contract validation `32204865594`: **success**.
- Persistence `32204865644`: application-contract `95926003457` **success**; tauri-storage `95926003360` **success**.
- Main Playable run `32204865588`: playable-contract `95926017359` **success**; Windows `95926276820` **success**, including Tauri persistence/session transport, Windows executable build, staging and artifact upload.
- Phase 11 run `32204865635`: offline-walkthrough `95926003264` **success**; Windows `95926114975` **success**, including executable build/stage/upload.
- Phase 12 run `32204865632`: connected-protocol `95926003189` **success**; Windows connected `95926150169` **success**, including Tauri session transport/persistence, executable build/stage/upload.

## Exact-head Windows artifact
Main Playable artifact is available for human acceptance:
- artifact id: `9348955693`
- artifact name: `SimpleVTT-Main-Playable-d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- workflow run: `32204865588`
- exact head: `d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- digest: `sha256:441b8eac5a0cea1cf9cbaff6788f2e7e4d0099f07d5d2c6c0deca1a2f3fefc96`

## Previously validated boundaries — do not repeat unless touched
1. Production Play.
2. Composable Combat VFX.
3. Appearance preferences.
4. Direct-IP Session entry/configuration.
5. Automatic Host-required declarative content parity before Ready.
6. Character portrait + DM image handout/reconnect.
7. Contextual DM/Content polish + production dead-wiring cleanup.
8. Proven-unreachable legacy `App.tsx` cleanup plus named-rule baseline alignment.

## Next Exact Action
1. Wait for focused human Windows acceptance on the exact-head Main Playable artifact above.
2. Human retest must verify exactly the four reopened observations: dice appearance matches the established UI demo; demo attack is executable; official sheet layout is visible/selectable; distinct Character cards open distinct canonical Characters.
3. If any observation still fails, set the same sequence back to `continue`, record the exact human repro, and fix only the observed failure.
4. If all four pass, record the human acceptance result before any V0.9 completion decision.
5. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
