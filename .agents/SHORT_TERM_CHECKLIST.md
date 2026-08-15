# Phase 09 Short-Term Checklist

이 문서는 현재 작업 순서를 빠르게 추적하기 위한 **단기 실행 체크리스트**다.

- Long-term / canonical working context: `.agents/CURRENT_WORK.md`
- Deferred owner regressions: `.agents/DEFERRED_FIXES.md`
- 현재 Phase: **Rules Engine Phase 09 — Mechanics Integration / RealAdapter**
- 운영 규칙: 새 slice를 시작하기 전에 이 파일의 상태를 먼저 갱신하고, 구현/검증/PR checkpoint가 끝날 때 다시 갱신한다.
- Owner progression gate는 별도 OPEN 상태이며, owner 확인 전 PR #60을 ready/merge하지 않는다.

## Phase 09 실행 단계

### 1. Turn lifecycle / effect-aware turn — IN VALIDATION

- [x] domain `end-turn(current)` + `begin-turn(next)` lifecycle service
- [x] current end-turn effect expiry
- [x] next start-turn effect expiry
- [x] post-expiry condition 기반 movement / Action / Bonus Action / Reaction 계산
- [x] production `MockAdapter.endTurn()` overlay wiring
- [x] raw lifecycle ResolutionEvent -> Activity projection
- [x] adapter / structure regression tests
- [ ] latest UI + Rules Domain checks 최종 확인
- [ ] verified checkpoint를 기록하고 Step 1을 CLOSED로 전환

Tracking: Issue #69 / Draft PR #70

### 2. Concentration damage save authoritative dice workflow — NEXT

- [ ] 피해 transaction이 concentration check 필요 상태를 명시적으로 노출
- [ ] 실제 d20 입력을 받는 app/adapter contract
- [ ] CON saving throw modifier / proficiency를 기존 authoritative stat 경계에서 공급
- [ ] domain `concentrationCheckDc()` / `resolveConcentrationDamageCheck()`만 판정에 사용
- [ ] 입력이 없으면 자동 roll/DC/modifier를 발명하지 않고 explicit reject 유지
- [ ] 성공: concentration 유지
- [ ] 실패: concentration + group effects 제거
- [ ] HP + concentration + effect changes를 동일 raw ResolutionEvent transaction에 보존
- [ ] Activity에 concentration save 결과/provenance 표시
- [ ] event-native Undo가 HP + concentration + effects를 exact restore
- [ ] stale runtime revision / drift explicit reject
- [ ] deterministic service tests
- [ ] adapter/UI workflow regression
- [ ] full Phase 09 + Rules Domain + TypeScript + production build green
- [ ] Draft PR checkpoint

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
Step 1: implementation complete, final validation pending
Step 2: queued next — Concentration damage save authoritative dice workflow
```
