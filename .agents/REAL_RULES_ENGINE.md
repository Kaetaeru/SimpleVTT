# Real Rules Engine 작업 체크리스트

Issue: #39
Branch: `agent/39-real-rules-engine-phase-01`

## 판단

현재 UI는 `SimpleVttAdapter` 뒤에서 MockAdapter로 규칙 흐름을 충분히 검증했고, RulesProfile/Common Rule Specification에는 계산 정책과 공통 primitive가 이미 정의돼 있다. 따라서 다음 병목은 콘텐츠 양이 아니라 **계약을 실제로 실행하는 React-independent domain kernel**이다.

UI Session 01의 owner walkthrough는 계속 진행하되, 엔진은 별도 브랜치에서 병렬로 구현한다. PR #37에는 엔진 실험을 직접 섞지 않는다. PR #38의 semantic catalog는 generic engine이 준비된 뒤 연결한다.

## Phase 01 — executable kernel

- [ ] `src/domain/` package boundary 생성
- [ ] restricted expression AST evaluator 구현
- [ ] property reference resolution + explicit failure 구현
- [ ] ability modifier golden fixture를 실제 계산
- [ ] Advantage/Disadvantage contribution resolver 구현
- [ ] 상쇄된 source provenance 유지
- [ ] 기존 rules golden fixtures를 실제 엔진 결과와 비교
- [ ] Vitest 기반 deterministic unit test 추가
- [ ] `npm test` 추가
- [ ] UI GitHub Actions에서 test + build 실행
- [ ] generic resolver에 named class/spell/item 분기 없음 확인
- [ ] runtime prose parsing 없음 확인

## Phase 01 완료 기준

1. ability modifier fixture가 schema 검사가 아니라 실제 domain 계산으로 `+2`를 만든다.
2. Advantage + Disadvantage fixture가 실제 domain 계산으로 `normal`을 만들고 두 source를 suppressed provenance로 보존한다.
3. `npm test`와 `npm run build`가 모두 통과한다.
4. 이후 공격/피해/주문이 같은 primitive 위에 확장 가능한 구조다.

## 다음 순서

- [ ] Phase 02: d20 check/save/attack + authoritative dice
- [ ] Phase 03: typed damage/healing/critical/Resistance/Vulnerability/Immunity/temp HP/0 HP
- [ ] Phase 04: Initiative/action economy/targeting/Reaction
- [ ] Phase 05: EffectInstance/condition/duration/concentration/rest/resource lifecycle
- [ ] Phase 06: spellcasting kernel
- [ ] Phase 07: Character progression + ChoiceDefinition + multiclass
- [ ] Phase 08: PR #38 semantic catalog 연결 및 mechanics coverage 확대
- [ ] Phase 09: MockAdapter 경로를 RealAdapter로 순차 교체

## 구현 완료 판정

`cataloged`나 `presentation-only`만으로 완료로 세지 않는다. mechanic은 declarative definition이 validation을 통과하고, generic domain primitive로 실행되고, deterministic test가 결과를 검증하며, provenance/StateChange가 설명 가능해야 구현 완료로 센다.
