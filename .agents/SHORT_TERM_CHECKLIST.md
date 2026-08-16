# Phase 09 Short-Term Checklist

이 문서는 현재 작업 순서를 빠르게 추적하기 위한 **단기 실행 체크리스트**다.

- Long-term / canonical working context: `.agents/CURRENT_WORK.md`
- Deferred owner regressions: `.agents/DEFERRED_FIXES.md`
- 현재 Phase: **Rules Engine Phase 09 — Mechanics Integration / RealAdapter**
- 운영 규칙: 새 slice를 시작하기 전에 이 파일의 상태를 먼저 갱신하고, 구현/검증/PR checkpoint가 끝날 때 다시 갱신한다.
- Owner progression gate는 별도 OPEN 상태이며, owner 확인 전 PR #60을 ready/merge하지 않는다.

## Phase 09 실행 단계

### 1. Turn lifecycle / effect-aware turn — CLOSED

- [x] domain `end-turn(current)` + `begin-turn(next)` lifecycle service
- [x] current end-turn effect expiry
- [x] next start-turn effect expiry
- [x] post-expiry condition 기반 movement / Action / Bonus Action / Reaction 계산
- [x] production `MockAdapter.endTurn()` overlay wiring
- [x] raw lifecycle ResolutionEvent -> Activity projection
- [x] adapter / structure regression tests
- [x] legacy `advanceTurnRuntimeSession()` direct reset 제거; 동일 domain lifecycle transaction 사용
- [x] latest UI + Rules Domain checks 최종 확인
- [x] verified checkpoint 기록

Verified implementation checkpoint: `1fca7c6050784908a2c9c04155269a13955140fb`

Verification:
- UI Phase 09 mechanics ✅
- authoritative spellcasting gate ✅
- TypeScript / production build ✅
- Rules Domain ✅
- Contract validation ✅

Tracking: Issue #69 / Draft PR #70

### 2. Concentration damage save authoritative dice workflow — CLOSED

- [x] 피해 transaction이 concentration check 필요 상태를 명시적으로 노출
- [x] 실제 d20 입력을 받는 app/adapter contract
- [x] CON saving throw modifier / proficiency를 기존 authoritative stat 경계에서 공급
- [x] domain `concentrationCheckDc()` / `resolveConcentrationDamageCheck()`만 판정에 사용
- [x] 입력이 없으면 자동 roll/DC/modifier를 발명하지 않음; lower-level domain explicit reject + app pending-input state 유지
- [x] 성공: concentration 유지
- [x] 실패: concentration + group effects 제거
- [x] HP + concentration + effect changes를 동일 raw ResolutionEvent transaction에 보존
- [x] Activity에 concentration save 결과/provenance 표시
- [x] event-native Undo가 HP + concentration + effects를 exact restore
- [x] stale runtime revision / concentration-group drift explicit reject
- [x] deterministic domain result test: natural/modifier/total/DC/outcome 보존
- [x] Character CON proficiency + Combatant structured save-stat boundary regression
- [x] adapter workflow + UI no-rule-arithmetic structure gate
- [x] full Phase 09 + Rules Domain + TypeScript + production build green
- [x] Draft PR checkpoint

Verified implementation checkpoint: `ee95adf56a9f6481f754df5dbf5fde277bc18912`

Verification:
- UI Phase 09 mechanics + concentration workflow/structure ✅
- TypeScript / production build ✅
- Rules Domain core primitives + typed concentration result ✅
- spellcasting / progression integration gates ✅

Tracking: Issue #71 / Draft PR #72
Branch: `agent/71-concentration-save-workflow`

### 3. Combatant runtime action expansion — CLOSED

- [x] authoritative spatial facts가 있는 encounter instance로 runtime actions 확대
- [x] imported / builtin Combatant representative actions
- [x] missing stat/spatial fact guess 금지
- [x] Activity / Undo convergence
- [x] deterministic runtime-action regressions
- [x] runtime spatial provenance를 targeting ResolutionEvent / Activity에 보존
- [x] full Phase 09 + Rules Domain + TypeScript + production build green
- [x] Draft PR checkpoint

Verified implementation checkpoint: `3b4afb6adfe9de26c83cf5bace672a79af95e7cd`

Verification:
- UI workflow `31898238908` ✅
- Phase 09 mechanics 98/98 ✅
- TypeScript / production build ✅
- Rules Domain workflow `31898238909` ✅
- spellcasting / progression integration gates ✅

Tracking: Issue #73 / Draft PR #74
Branch: `agent/73-combatant-runtime-actions`

### 4. Character Creation ChoiceDefinition convergence — CLOSED

- [x] creation 전용 `CreationChoiceSpec` producer/consumer inventory
- [x] dynamic creation rule choices를 공용 `ChoiceDefinition`으로 변환하는 application boundary
- [x] 기존 `choiceSelections: Record<string,string[]>`는 Phase 10 전까지 compatibility storage로 유지하고 `ChoiceSelectionMap`으로 변환
- [x] 공용 `validateChoiceDefinitions()`로 dynamic creation blocking validation 수렴
- [x] Plan이 공용 definitions/options/validation을 소비
- [x] Adapter toggle/normalize가 공용 definition boundary를 직접 소비
- [x] owner / automaticGrants / 한국어·영문 presentation metadata는 app-only wrapper로 분리
- [x] 빈 선택 배열은 공용 selection map에서 미선택으로 정규화하여 blocked optional choice false-positive 차단
- [x] stable ID / count / option ID / source parity regression
- [x] Wizard spellbook -> prepared dependent-choice regression
- [x] creation UI named-rule validation 비소유 structure gate
- [x] creation level-1 choice가 progression-only ASI/subclass를 제조하지 않는 regression
- [x] 기존 created Monk -> level 2 no phantom ASI progression handoff gate 유지
- [x] creation ChoiceDefinition gate를 canonical `test:creation-structure:raw`에 편입
- [x] full creation/progression + Rules Domain + TypeScript + production build green
- [x] Draft PR checkpoint

Verified implementation checkpoint: `d0bb91a835020cf457c85cd5beede5fc8ffb3303`

Verification:
- UI workflow `31898762544` ✅
- creation ChoiceDefinition + structure gate ✅
- progression choice schedule / created Monk handoff ✅
- Phase 09 mechanics ✅
- TypeScript / production build ✅
- Rules Domain workflow `31898762524` ✅

Tracking: Issue #75 / Draft PR #76
Branch: `agent/75-creation-choice-definition`

### 5. Progression / rest / class-feature application service convergence — CLOSED

- [x] progression / rest / class-feature direct-write inventory
- [x] shared CharacterSheet <-> ProgressionCharacterState projection boundary
- [x] level-up commit write-back을 shared application service로 수렴
- [x] Wizard Long Rest preparation write-back을 scoped shared application으로 수렴
- [x] Pact Tome rest write-back을 explicit `pact-tome` scope로 수렴
- [x] Circle Land는 별도 `CircleLandSpellRestState` revision domain임을 구조 gate로 명시하고 progression write-back과 의도적으로 분리
- [x] class-feature/core/subclass + Sorcery Point + Signature Spell resource upsert 수렴
- [x] revision / source / non-refill / idempotent semantics 보존
- [x] shared application service + structure regressions를 canonical creation/progression build gates에 편입
- [x] existing progression/rest/class-feature regressions green
- [x] full creation/progression + Rules Domain + TypeScript + production build green
- [x] Draft PR checkpoint

Verified implementation checkpoint: `7b0b9e237f0763e2fd2020452594e4fefc501fa8`

Verification:
- UI workflow `31899274706` ✅
- shared progression application service / structure gates ✅
- creation / progression / rest / class-feature runtime regressions ✅
- Phase 09 mechanics ✅
- TypeScript / production build ✅
- Rules Domain workflow `31899236207` ✅

Tracking: Issue #77 / Draft PR #78
Branch: `agent/77-progression-application-service`

### 6. UI named-rule structural gate — CLOSED

- [x] UI component named-rule 계산 inventory
- [x] React/UI 계층의 허용 presentation-only 계산과 금지 named-rule 계산 분류
- [x] LevelUp multiclass eligibility / fixed HP rule facts를 application projection으로 이동
- [x] V09 ability modifier / standard array / point-buy rule facts를 application projection으로 이동
- [x] domain/application 밖 신규 named-rule 계산 차단 CI gate
- [x] scanner blocked/allowed fixture regression
- [x] 기존 legitimate UI-only formatting false positive 최소화
- [x] 기존 legacy/presentation debt를 `.agents/UI_NAMED_RULE_BASELINE.json`에 정확히 동결; 새 occurrence 금지
- [x] canonical `npm run build` 앞단 + UI workflow explicit gate 편입
- [x] full UI + Phase 09 mechanics + TypeScript + production build green
- [x] Rules Domain green
- [x] Draft PR checkpoint

Verified implementation checkpoint: `0a4ab92a96e5d8ce41c2a5a3030ef1cb58bebb90`

Verification:
- UI workflow `31923163173` ✅
- UI named-rule structural gate ✅
- creation ChoiceDefinition / progression schedule gates ✅
- Phase 09 mechanics ✅
- TypeScript / production build ✅
- Rules Domain workflow `31900294157` ✅

Tracking: Issue #79 / Draft PR #80
Branch: `agent/79-ui-named-rule-gate`

### 7. Optional 3D dice renderer — DEFERRED

- [ ] WebGL / physics renderer — optional, 규칙 정확도 작업보다 후순위
- 현재 CSS 3D/faceted renderer는 authoritative result replay만 담당하고 규칙 결과를 생성/변경하지 않음

### 8. Optional external 2D/3D module loader — DEFERRED

- [ ] **실제 외부 module 요구가 생길 때만** 설계/구현
- [x] Core movement/map/grid/token/path/LOS ownership 금지 유지

## Current cursor

```text
Phase 09 mandatory integration
Step 1: CLOSED @ 1fca7c6050784908a2c9c04155269a13955140fb · PR #70
Step 2: CLOSED @ ee95adf56a9f6481f754df5dbf5fde277bc18912 · PR #72
Step 3: CLOSED @ 3b4afb6adfe9de26c83cf5bace672a79af95e7cd · PR #74
Step 4: CLOSED @ d0bb91a835020cf457c85cd5beede5fc8ffb3303 · PR #76
Step 5: CLOSED @ 7b0b9e237f0763e2fd2020452594e4fefc501fa8 · PR #78
Step 6: CLOSED @ 0a4ab92a96e5d8ce41c2a5a3030ef1cb58bebb90 · PR #80
Step 7: DEFERRED — optional visual upgrade
Step 8: DEFERRED — only if a real external map/module requirement appears

Next: Phase 09 completion audit against CURRENT_WORK completion criterion.
Owner progression walkthrough remains a separate OPEN acceptance gate and does not permit PR #60 ready/merge until owner verification.
```
