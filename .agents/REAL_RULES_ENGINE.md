# Real Rules Engine 작업 체크리스트

Issue: #39
PR: #40
Branch: `agent/39-real-rules-engine-phase-01`

## 판단

현재 UI는 `SimpleVttAdapter` 뒤에서 MockAdapter로 규칙 흐름을 충분히 검증했고, RulesProfile/Common Rule Specification에는 계산 정책과 공통 primitive가 이미 정의돼 있다. 따라서 다음 병목은 콘텐츠 양이 아니라 **계약을 실제로 실행하는 React-independent domain kernel**이다.

UI Session 01의 owner walkthrough는 계속 진행하되, 엔진은 별도 브랜치에서 병렬로 구현한다. PR #37에는 엔진 실험을 직접 섞지 않는다. PR #38의 semantic catalog는 generic engine이 준비된 뒤 연결한다.

## Phase 01 — executable kernel ✅

- [x] `src/domain/` package boundary 생성
- [x] restricted expression AST evaluator 구현
- [x] property reference resolution + explicit failure 구현
- [x] ability modifier golden fixture를 실제 계산
- [x] Advantage/Disadvantage contribution resolver 구현
- [x] 상쇄된 source provenance 유지
- [x] 기존 rules golden fixtures를 실제 엔진 결과와 비교
- [x] dependency-free Node 22 `node:test` deterministic test 추가
- [x] 전용 `Rules Domain` GitHub Actions workflow 추가
- [x] domain compile + golden fixtures + application typecheck 실행
- [x] generic resolver에 named class/spell/item 분기 없음 확인
- [x] runtime prose parsing 없음 확인

### Phase 01 검증 결과

- Rules Domain run #1: success
- TypeScript domain compile: success
- ability modifier golden fixture: pass
- Advantage/Disadvantage cancellation fixture: pass
- application `tsc --noEmit`: success
- 기존 UI workflow: success
- 기존 Contract validation: success

`package.json`에 test dependency/script를 추가하지 않았다. 현재 테스트는 기존 TypeScript와 Node 22 내장 test runner만 사용한다. 이 방식은 앱 dependency surface를 늘리지 않는다.

## Phase 02 — d20 resolution ← current

목표: MockAdapter에 하드코딩된 d20/공격/내성 계산을 generic domain primitive로 옮길 수 있는 최소 resolution core를 만든다.

- [ ] authoritative DiceRecord 정의
- [ ] normal / advantage / disadvantage의 d20 선택 규칙 구현
- [ ] D20 Test request/result 공통 타입 구현
- [ ] ability-check resolution 구현
- [ ] saving-throw resolution 구현
- [ ] attack-roll resolution 구현
- [ ] attack의 natural 1 / natural 20 및 critical 결과를 RulesProfile/SRD 정책에 맞게 처리
- [ ] DC/AC 비교 결과와 modifier source provenance 유지
- [ ] deterministic fixed dice 입력만 사용하고 resolver 내부 RNG는 두지 않음
- [ ] Phase 02 golden scenarios 추가
- [ ] 기존 Phase 01 regression 유지
- [ ] Rules Domain CI green

## 다음 순서

- [ ] Phase 03: typed damage/healing/critical/Resistance/Vulnerability/Immunity/temp HP/0 HP
- [ ] Phase 04: Initiative/action economy/targeting/Reaction
- [ ] Phase 05: EffectInstance/condition/duration/concentration/rest/resource lifecycle
- [ ] Phase 06: spellcasting kernel
- [ ] Phase 07: Character progression + ChoiceDefinition + multiclass
- [ ] Phase 08: PR #38 semantic catalog 연결 및 mechanics coverage 확대
- [ ] Phase 09: MockAdapter 경로를 RealAdapter로 순차 교체

## 구현 완료 판정

`cataloged`나 `presentation-only`만으로 완료로 세지 않는다. mechanic은 declarative definition이 validation을 통과하고, generic domain primitive로 실행되고, deterministic test가 결과를 검증하며, provenance/StateChange가 설명 가능해야 구현 완료로 센다.
