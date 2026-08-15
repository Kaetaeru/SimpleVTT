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
- [ ] Rules Engine Phase 09 — real mechanics integration / RealAdapter ← **next**

Phase 08 integration branch/PR:

```text
Issue #51  rules: execute Phase 08 catalog relationships
PR    #52  agent/50-rules-phase08
```

## Phase 08 — Catalog Relationships / Class Mechanics ✅

목표: Phase 07의 `catalog-pending` 선택을 실제 SRD 5.2.1 stable-ID 관계와 mechanics-backed 실행 경로로 교체한다.

완료 기준:

- 12개 클래스 × 레벨 2-20 outermost progression audit에서 `catalog-pending` **0개**
- unsupported downstream mechanic은 silent approximation 없이 explicit reject
- stable ID + provenance + ChoiceDefinition + atomic revision-checked commit 유지
- Contract / Rules Domain / Phase 07/08 aggregate progression / TypeScript / UI-build 전체 green

### 완료/구현된 주요 범위

- [x] ChoiceDefinition required/optional/disabled/duplicate validation
- [x] class / spell / feat / feature stable-ID 관계와 provenance
- [x] generated spell / feat / weapon / class-skill rule metadata
- [x] Expertise, higher-level spell choices, Metamagic, Invocations, Mystic Arcanum
- [x] Epic Boon generated catalog + Phase 08 progression resolver + CharacterSheet projection
- [x] weapon mastery / fighting style progression catalogs
- [x] Ranger / Hunter progression + representative runtime mechanics
- [x] Paladin / Oath of Devotion progression + representative runtime mechanics
- [x] Cleric + Life Domain mechanics-backed progression/runtime
- [x] Greater Divine Intervention Wish basic spell-replication path for fully executable level-8-or-lower spell mechanics + exact 2d4 Long-Rest lockout
- [x] Druid + Circle of the Land mechanics-backed progression/runtime + session-scoped current-land configuration
- [x] Fighter + Champion mechanics-backed progression/runtime
- [x] Barbarian + Path of the Berserker high-level subclass mechanics
- [x] Monk + Warrior of the Open Hand high-level subclass relationships and mechanics contracts
- [x] Rogue + Thief high-level subclass relationships and mechanics contracts
- [x] Bard progression + College of Lore + Bardic Inspiration domain/runtime
- [x] Wizard spellbook / Scholar / Spell Mastery / Signature Spells / Long-Rest preparation + School of Evocation domain/runtime
- [x] Sorcerer progression / Metamagic replacement / Draconic Sorcery domain/runtime
- [x] Warlock Pact Magic / Invocation replacement / Mystic Arcanum / Pact of the Tome + Fiend Patron mechanics
- [x] Wizard Long-Rest, Pact of the Tome rest, Circle of the Land rest application commands
- [x] authoritative attack transaction, compound damage, restricted extra Actions, resource recovery lockouts
- [x] latest subclass domain/UI/runtime tests are part of the formal CI gates

### Phase 08 마감 결과

- [x] Bard Lore / Sorcerer Draconic / Wizard Evocation progression wrapper를 실제 앱 adapter chain에 끝까지 연결
- [x] 최신 Phase 08 domain/UI 테스트를 정식 CI gate에 편입
- [x] Greater Divine Intervention Wish basic replication executable path 연결
- [x] Circle of the Land current-land를 permanent Character field가 아닌 rest/session configuration state로 정리
- [x] Berserker / Devotion / Hunter / Fiend / Open Hand / Thief 고레벨 subclass catalog relationship을 mechanics-backed stable ID로 연결
- [x] outermost Phase 08 audit: `catalog-pending` 18 → 0
- [x] rules implementation checkpoint `3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb`에서 Contract / Rules Domain / UI full green
- [x] README / CURRENT_WORK / PR #52 completion state 동기화

Phase 08의 completion boundary는 **catalog relationship과 현재 rules primitive로 표현 가능한 mechanics-backed contract를 모두 materialize하고, 현재 primitive 밖의 downstream 실행 형태는 explicit reject로 남기는 것**이다. 예를 들어 Open Hand Quivering Palm의 Action activation은 실행되며, Attack action 내부의 단일 공격 대체 경로는 generic attack-sequence replacement primitive가 생길 때까지 명시적으로 거부한다.

## Phase 09 — Mechanics Integration / RealAdapter

목표: Phase 08까지 만든 실제 규칙/콘텐츠를 MockAdapter 바깥의 공용 application/domain 경로로 수렴시킨다.

- [ ] Character Creation의 기존 전용 choice graph를 `ChoiceDefinition` 기반 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] MockAdapter의 규칙 계산 경로를 실제 domain resolver 호출로 교체
- [ ] ItemInstance 사용/charge/resource spend를 동일한 atomic `ResolutionEvent` transaction으로 실행
- [ ] Combatant instantiate/runtime action을 실제 domain state로 실행
- [ ] Freeform check/action/spell/item resolution을 real domain으로 실행
- [ ] Initiative / turn economy / Reaction / movement를 real domain으로 실행
- [ ] Activity Log의 dice/provenance/state change를 authoritative result에서 직접 투영
- [ ] Safe Undo/correction을 실제 committed `ResolutionEvent` 기준으로 동작
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
Phase 09 real mechanics integration / RealAdapter ← next
        ↓
Phase 10 persistence / ContentCatalog / homebrew platform
        ↓
Phase 11 complete offline vertical slice
        ↓
LAN/Hamachi authoritative session work
```

## 구현 원칙

실제 플레이/구현에서 표현 불가능하거나 불편한 경우:

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. unsupported mechanic은 explicit blocker로 유지하고 silent approximation을 하지 않는다.
7. UI는 domain contract와 가능한 한 분리하고 named-rule 계산을 React에 넣지 않는다.
