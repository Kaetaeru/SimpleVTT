# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위와 다음 구현 Gate를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] 제품/아키텍처 canonical 설계 통합
- [x] Common Rule Definition Specification `0.1-draft`
- [x] 초기 RulesProfile: **D&D SRD 5.2.1 / CC-BY-4.0**
- [x] executable rules contracts + deterministic validation
- [x] UI application shell / interaction prototype
- [x] complete SRD-backed level-1 Character Creation slice
- [x] canonical 339-spell Korean-first presentation catalog
- [x] Rules Engine Phase 01 — executable profile kernel
- [x] Rules Engine Phase 02 — D20 resolution
- [x] Rules Engine Phase 03 — typed damage / healing / life primitives
- [x] Rules Engine Phase 04 — targeting / economy / combat transaction
- [x] Rules Engine Phase 05 — EffectInstance lifecycle / atomic ResolutionEvent
- [x] Rules Engine Phase 06 — spellcasting kernel + reference runtime bridge
- [x] Rules Engine Phase 07 — 1-20 progression / multiclass / ChoiceDefinition
- [x] Rules Engine Phase 08 — canonical catalog relationships + class/subclass mechanics
- [ ] Rules Engine Phase 09 — real mechanics integration / RealAdapter ← **current**

현재 작업 스택:

```text
Issue #53  app: converge Phase 09 mechanics into RealAdapter services
PR    #54  agent/53-mechanics-phase09
Base       agent/50-rules-phase08 (PR #52)
```

## Phase 08 — Catalog Relationships / Class Mechanics ✅

완료 기준:

- 12개 SRD 클래스 × target level 2-20 outermost progression audit에서 `catalog-pending` **0개**
- unsupported downstream mechanic은 silent approximation 없이 explicit reject
- stable ID + provenance + ChoiceDefinition + atomic revision-checked commit 유지
- Contract / Rules Domain / Phase 07/08 aggregate progression / TypeScript / UI-build 전체 green

Rules implementation checkpoint:

```text
3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb
```

Phase 08 integration/document head:

```text
ef2f726a248c538fdbd9c6c2d23b38321aae5e45
```

## Phase 09 — Mechanics Integration / RealAdapter ← current

목표: Phase 08까지 만든 실제 규칙/콘텐츠를 MockAdapter-owned 규칙 계산에서 공용 application/domain service로 수렴시키고, 대표 플레이 경로를 authoritative domain 결과로 실행한다.

현재 branch는 MockAdapter를 **transitional fixture/state storage**로 유지하되, 계산 자체를 단계적으로 실제 domain resolver로 옮긴다. React/UI contract는 유지한다.

### 완료된 integration cluster

- [x] target/DC를 발명하지 않는 generic `openD20` domain primitive
- [x] Freeform 능력 판정 → `resolveOpenD20Roll` → application `ResolutionView` projection
- [x] 공격 명중 판정 → domain `resolveD20Test`
  - natural 1 자동 실패
  - natural 20 자동 명중/치명타
  - target AC + provenance authoritative projection
- [x] 공격 typed damage → domain `resolveDamage`
  - resistance / vulnerability / immunity
  - Temporary HP → HP 순서
  - domain provenance/state-change projection
- [x] Action / Bonus Action / Reaction + class resource 비용을 `resolvePendingResolution`의 동일 transaction으로 실행하는 application service
  - resource 부족 시 앞선 economy spend까지 atomic rollback 검증
  - freeform에서는 turn economy 비소비
- [x] migrated non-item commit에서 domain economy/resource transaction 결과를 Scene/Activity에 projection
- [x] healing state 적용 → domain `resolveHealing`
- [x] Second Wind representative path
  - healing 적용
  - Bonus Action 소비
  - Second Wind resource 소비
  - Activity provenance/state changes
  - 기존 Undo로 HP/resource/economy before snapshot 복원
- [x] saving throw target modifier의 index 기반 Mock 계산 제거
  - 대상별 explicit reference save facts 사용
  - 대상 순서를 바꿔도 modifier identity 유지
  - 각 대상 판정을 domain `resolveD20Test`로 실행
- [x] saving-throw damage도 domain `resolveDamage`로 실행
  - save-half → resistance/vulnerability/immunity → Temporary HP → HP 순서 검증
  - Thunderwave multi-target representative path 검증
- [x] Phase 09 service/adapter regression tests를 UI CI gate에 편입
- [x] Phase 08 zero-pending + aggregate progression 회귀 유지

현재 integration checkpoint:

```text
37e5f7b5a4d6b507fdb7789cf3a1d28af6ee5b40
```

검증:

```text
Contract validation  ✅
Rules Domain         ✅
Phase 08 zero-pending audit ✅
Phase 07/08 aggregate progression ✅
TypeScript           ✅
Phase 09 service/adapter tests ✅
UI production build ✅
```

### 다음 Phase 09 작업

- [ ] staged attack의 hit + damage + economy/resource를 하나의 authoritative ResolutionEvent transaction으로 수렴
- [ ] healing dice/formula calculation까지 공용 dice service로 수렴
- [ ] saving modifier reference facts를 실제 Combatant/Character runtime stats 공급자로 교체
- [ ] ItemInstance quantity/charges/resource spend를 atomic ResolutionEvent transaction으로 실행
- [ ] Combatant instantiate/runtime action을 실제 domain state로 실행
- [ ] Initiative / turn economy / Reaction / movement를 real runtime state에서 직접 실행
- [ ] Activity Log의 dice/provenance/state change를 committed domain events에서 직접 projection
- [ ] Safe Undo/correction을 before-snapshot bridge에서 committed ResolutionEvent 기준으로 점진 전환
- [ ] Character Creation의 기존 전용 choice graph를 `ChoiceDefinition` 기반 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] UI component가 named-rule 계산을 하지 않고 application contracts만 소비한다는 구조 gate 추가

Phase 09 완료 기준:

> 기존 화면 흐름을 유지하면서 대표 Character/Combatant 플레이 경로가 MockAdapter의 규칙 계산 없이 실제 rules domain을 사용한다.

## Phase 10 — Persistence / Content Platform

목표: 실제 rules domain 상태와 콘텐츠를 로컬에서 안전하게 지속시키고 homebrew/module composition을 product path로 만든다.

- [ ] local Character library persistence
- [ ] Character source/build revision + durable runtime revision 저장
- [ ] autosaved creation/progression draft persistence + recovery
- [ ] real `ContentCatalog` service
- [ ] builtin + local/homebrew RuleModule composition
- [ ] stable ID/reference/registry semantic validation
- [ ] module dependency/version/capability validation
- [ ] parent / extends / replaces cycle/conflict validation
- [ ] local homebrew JSON import → validation → human review → activation
- [ ] Character가 의존하는 exact module/version/content identity 보존
- [ ] ItemInstance / spellbook / resources / durable feature state persistence
- [ ] atomic local save + failed-save/unsaved-local recovery state

Phase 10 완료 기준:

> 앱을 종료/재실행해도 Character, progression, inventory, spell/resource state, local modules가 정확히 복원되며 invalid/incompatible content는 명시적으로 거부된다.

## Phase 11 — Complete Offline Vertical Slice

목표: 네트워크 없이 한 PC에서 SimpleVTT의 핵심 플레이 루프를 **mock 없이 처음부터 끝까지** 수행한다.

- [ ] Character 생성 → finalize → 저장 → 재실행 후 복원
- [ ] 실제 SRD progression으로 level-up / multiclass
- [ ] equipment / ItemInstance / charges / resources 사용
- [ ] Freeform ability/save/action/spell/item resolution
- [ ] Initiative 시작 → initiative order → turn economy → 종료
- [ ] attack / critical / typed damage / healing / conditions / Concentration
- [ ] reaction/interrupt decision flow
- [ ] class/subclass mechanics의 representative end-to-end 실행
- [ ] Combatant import/review/instantiate → 실제 action resolution
- [ ] DM situational adjudication/correction
- [ ] authoritative activity/dice/provenance log
- [ ] safe Undo / correction / revision consistency
- [ ] 전체 offline walkthrough deterministic integration gate

Phase 11 완료 기준:

> **MockAdapter 없이 SimpleVTT 한 판을 실제 규칙 엔진으로 처음부터 끝까지 플레이할 수 있다.**

이 시점부터 SimpleVTT를 실제 사용 가능한 offline VTT baseline으로 본다. real LAN/Hamachi session authority와 networking은 그 다음 Phase에서 진행한다.

## 현재 Gate

```text
Phase 01-08 rules/catalog foundation ✅
        ↓
Phase 09 real mechanics integration / RealAdapter ← current
        ↓
Phase 10 persistence / ContentCatalog / homebrew platform
        ↓
Phase 11 complete offline vertical slice
        ↓
LAN/Hamachi authoritative session work
```

## 구현 원칙

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. unsupported mechanic은 explicit blocker로 유지하고 silent approximation을 하지 않는다.
7. UI는 domain contract와 가능한 한 분리하고 named-rule 계산을 React에 넣지 않는다.
