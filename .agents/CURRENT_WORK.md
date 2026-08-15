# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위와 다음 구현 Gate를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] Rules Engine Phase 01-08 — executable rules foundation + canonical catalog/class mechanics
- [ ] Rules Engine Phase 09 — real mechanics integration / RealAdapter ← **current**
- [ ] Phase 10 — persistence / Content Platform
- [ ] Phase 11 — complete offline vertical slice

현재 작업 스택:

```text
Issue #53  app: converge Phase 09 mechanics into RealAdapter services
PR    #54  agent/53-mechanics-phase09
Base       agent/50-rules-phase08 (PR #52)
```

## Phase 08 — Catalog Relationships / Class Mechanics ✅

완료 경계:

- 12개 SRD 클래스 × target level 2-20 outermost progression audit에서 `catalog-pending` **0개**
- unsupported downstream mechanic은 silent approximation 없이 explicit reject
- stable ID + provenance + ChoiceDefinition + atomic revision-checked commit 유지
- Contract / Rules Domain / Phase 07/08 aggregate progression / TypeScript / UI build 전체 green

Implementation checkpoint:

```text
3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb
```

## Phase 09 — Mechanics Integration / RealAdapter ← current

목표: Phase 08까지 만든 실제 규칙/콘텐츠를 MockAdapter-owned 규칙 계산에서 공용 application/domain service로 수렴시키고, 대표 플레이 경로를 authoritative domain 결과로 실행한다.

현재 `MockAdapter`는 **transitional fixture/state storage**로만 점진 축소한다. React/UI contract는 유지하며 named-rule 계산을 UI에 넣지 않는다.

### 완료된 integration cluster

#### D20 / runtime stats

- [x] target/DC를 발명하지 않는 generic `openD20` primitive
- [x] Freeform 능력 판정 → domain open-D20 → 기존 `ResolutionView`
- [x] 공격 명중/치명타 → canonical `resolveD20Test`
  - natural 1 자동 실패
  - natural 20 자동 명중/치명타
- [x] saving throw target-index Mock modifier 제거
- [x] Character saving throw를 현재 ability + proficiencyBonus + canonical class save proficiency에서 계산
- [x] built-in Combatant saving throw를 structured ability-score runtime stat에서 계산
- [x] 대상 순서를 바꿔도 save modifier identity 유지
- [x] runtime stat이 없는 imported Combatant는 modifier를 추측하지 않고 explicit reject

#### Damage / healing / dice

- [x] typed damage → domain `resolveDamage`
  - resistance / vulnerability / immunity
  - Temporary HP → HP 순서
- [x] saving-throw damage의 save-half → typed defense → Temp HP → HP 경로
- [x] healing state 적용 → domain `resolveHealing`
- [x] generic fixed dice/formula primitive
- [x] structured healing rolls
  - Second Wind `1d10 + 5`
  - Healing Word `1d4 + 4`
  - Healing Potion `2d4 + 2`
- [x] Wand structured `3d4+3` force damage

#### 3D visual dice replay

- [x] `authoritativeDice` → presentation-only visual roll contract
- [x] d4 / d6 / d8 / d10 / d12 / d20 CSS 3D/faceted renderer
- [x] attack/check/save/damage/healing authoritative faces replay
- [x] visual layer가 rules result를 생성하거나 변경하지 않음
- [x] reduced-motion 및 기존 Resolution auto-advance cadence 호환
- [ ] optional WebGL/physics renderer — authoritative-result replay contract는 그대로 유지

#### Atomic costs / ItemInstance

- [x] Action / Bonus Action / Reaction + class resource를 하나의 `resolvePendingResolution` transaction으로 실행
- [x] 뒤 resource spend가 실패하면 앞 economy spend까지 atomic rollback
- [x] ItemInstance quantity/charges를 temporary ResourcePool projection으로 동일 transaction에 연결
  - Potion quantity + Action
  - Wand charge + Action
  - 부족 quantity/charge는 economy까지 rollback

#### Runtime turn / Combatant state

- [x] initiative ordering / round / active actor를 Phase 09 `RulesRuntimeState` session으로 이동
- [x] `beginTurn()` 기반 Action / Bonus Action / Reaction / movement reset
- [x] manual actor 선택은 spent economy를 리셋하지 않음
- [x] round wrap은 temporary movementMaximum이 아니라 base speed로 복원
- [x] Scene HP/economy 변경을 runtime에 reconcile하고 다시 projection
- [x] initiative 도중 Combatant instantiate 시 active `RulesRuntimeState`에 즉시 materialize
- [x] 동적 Combatant 추가가 현재 턴을 재시작하지 않고 initiative order에 합류

#### ResolutionEvent / Activity / Undo

- [x] fully atomic Shortbow transaction의 raw `ResolutionEvent[]`를 application 결과에 보존
- [x] Shortbow Activity Log를 committed `ResolutionEvent[]`에서 직접 projection
- [x] Shortbow safe Undo를 before-snapshot 복원 대신 event state-change inverse로 실행
- [x] event `after`와 현재 state가 다르면 stale Undo를 explicit reject
- [x] event-native Undo 후 turn runtime에도 HP/economy를 reconcile

#### Representative E2E paths

- [x] Second Wind
  - structured healing → domain healing → Bonus Action + class resource transaction → Activity → Undo
- [x] Thunderwave
  - runtime target save stats → save-half → typed damage → resistance → Temp HP → Action cost
- [x] Shortbow fully atomic staged attack
  - canonical weapon catalog에서 `1d6`, `ammunition:80/320` 관계 사용
  - runtime scene target distance 사용
  - Apply 시 `resolveAttack` 하나로 targeting → d20 → critical dice → typed damage → Action economy
  - miss도 Action spend만 atomic commit
  - preview/domain drift는 explicit reject
  - critical은 **damage dice만 두 배**, flat modifier는 1회
  - Activity / Undo는 committed ResolutionEvent 기반
- [x] Healing Potion
  - structured `2d4+2` → healing → item quantity + Action transaction → Undo
- [x] Wand
  - visual `3d4` replay → typed force damage → charge + Action transaction → Undo

### 현재 verified implementation checkpoint

```text
0a13cd7ae759296df2d8c750a10658880014f6d1
```

검증:

```text
Contract validation               ✅
Rules Domain                      ✅
Phase 08 zero-pending audit       ✅
Phase 07/08 aggregate progression ✅
Phase 09 service/adapter tests    ✅
3D dice tests                     ✅
TypeScript                        ✅
UI production build               ✅
```

### 다음 Phase 09 작업

- [ ] Scene presentation `distance` 문자열과 default visibility/cover를 pairwise structured spatial/targeting runtime fact로 교체
- [ ] imported Combatant Definition에 ability/save/speed/defense/action runtime stats를 구조화하고 stat provider에 연결
- [ ] Combatant runtime action의 Mock `+3 · 1d6+1` 생성 경로를 실제 Definition/canonical action contract로 교체
- [ ] Shortbow 외 공격도 authoritative spatial/runtime data가 있는 범위부터 atomic `resolveAttack`으로 확대
- [ ] Thunderwave / Second Wind / Potion / Wand Activity를 raw committed ResolutionEvent stream projection으로 확대
- [ ] event-native Undo inverse를 resource/item/effect/concentration/life state change까지 확대
- [ ] saving-throw multi-target damage/economy를 하나의 atomic transaction 형태로 더 수렴
- [ ] movement / Reaction / interrupt command를 turn runtime 직접 command로 수렴
- [ ] Character Creation 전용 choice graph를 `ChoiceDefinition` 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] UI component에 named-rule 계산이 재유입되지 않는 구조 gate 추가
- [ ] optional WebGL/physics 3D dice renderer

Phase 09 완료 기준:

> 기존 화면 흐름을 유지하면서 대표 Character/Combatant 플레이 경로가 MockAdapter의 규칙 계산 없이 실제 rules domain을 사용하고, authoritative runtime/event state가 Activity와 Undo까지 일관되게 이어진다.

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
- [ ] exact module/version/content identity 보존
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
- [ ] class/subclass mechanics representative E2E
- [ ] Combatant import/review/instantiate → 실제 action resolution
- [ ] DM situational adjudication/correction
- [ ] authoritative activity/dice/provenance log
- [ ] safe Undo / correction / revision consistency
- [ ] 전체 offline walkthrough deterministic integration gate

Phase 11 완료 기준:

> **MockAdapter 없이 SimpleVTT 한 판을 실제 규칙 엔진으로 처음부터 끝까지 플레이할 수 있다.**

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
