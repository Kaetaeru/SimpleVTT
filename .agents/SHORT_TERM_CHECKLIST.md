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

### 2. Concentration damage save authoritative dice workflow — IN PROGRESS

- [x] 피해 transaction이 concentration check 필요 상태를 명시적으로 노출
- [x] 실제 d20 입력을 받는 app/adapter contract
- [x] CON saving throw modifier / proficiency를 기존 authoritative stat 경계에서 공급
- [x] domain `concentrationCheckDc()` / `resolveConcentrationDamageCheck()`만 판정에 사용
- [x] 입력이 없으면 자동 roll/DC/modifier를 발명하지 않음; lower-level domain explicit reject + app pending-input state 유지
- [x] 성공: concentration 유지
- [x] 실패: concentration + group effects 제거
- [x] HP + concentration + effect changes를 동일 raw ResolutionEvent transaction에 보존
- [ ] Activity에 concentration save 결과/provenance 표시 — event projection 연결됨, regression 확인 대기
- [x] event-native Undo가 HP + concentration + effects를 exact restore — regression 작성됨, CI 확인 대기
- [ ] stale runtime revision / drift explicit reject — 구현됨, 전용 regression 추가 필요
- [ ] deterministic service tests
- [ ] adapter/UI workflow regression — 작성/CI gate 연결됨, green 확인 대기
- [ ] full Phase 09 + Rules Domain + TypeScript + production build green
- [ ] Draft PR checkpoint

Current implementation branch: `agent/71-concentration-save-workflow`
Tracking: Issue #71

### 3. Combatant runtime action expansion

- [ ] authoritative spatial facts가 있는 encounter instance로 runtime actions 확대
- [ ] imported / builtin Combatant representative actions
- [ ] missing stat/spatial fact guess 금지
- [ ] Activity / Undo convergence

### 4. Character Creation ChoiceDefinition convergence

- [ ] creation 전용 choice graph inventory
- [ ] 공용 `ChoiceDefinition`으로 점진 수렴
- [ ] creation -> progression stable ID / provenance 정합성

### 5. Progression / rest / class-feature application service convergence

- [ ] level-up commands
- [ ] rest-time configuration
- [ ] class-feature application
- [ ] MockAdapter prototype wrapper 의존 감소

### 6. UI named-rule structural gate

- [ ] UI component named-rule 계산 inventory
- [ ] domain/application 밖 신규 계산 차단 CI gate

### 7. Optional 3D dice renderer

- [ ] WebGL / physics renderer — optional, 규칙 정확도 작업보다 후순위

### 8. Optional external 2D/3D module loader

- [ ] **실제 외부 module 요구가 생길 때만** 설계/구현
- [ ] Core movement/map/grid/token/path/LOS ownership 금지 유지

## Current cursor

```text
Phase 09
Step 1: CLOSED @ 1fca7c6050784908a2c9c04155269a13955140fb
Step 2: IN PROGRESS — implementation wired; regression/CI validation in progress
```
