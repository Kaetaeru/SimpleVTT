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

목표: Phase 08까지 만든 실제 규칙/콘텐츠를 MockAdapter-owned 규칙 계산에서 공용 application/domain service로 수렴시키고, 대표 플레이 경로를 authoritative domain/runtime/event 결과로 실행한다.

현재 `MockAdapter`는 **transitional fixture/state storage**로만 점진 축소한다. React/UI contract는 유지하며 named-rule 계산을 UI에 넣지 않는다.

### 완료된 integration cluster

#### D20 / runtime stats

- [x] target/DC를 발명하지 않는 generic `openD20`
- [x] Freeform 능력 판정 → domain open-D20
- [x] 공격 명중/치명타 → canonical `resolveD20Test`
- [x] Character save = current ability + proficiency bonus + canonical class save proficiency
- [x] built-in/imported Combatant structured ability/PB/save proficiency/speed/typed defense
- [x] runtime stat이 없으면 modifier 추측 없이 explicit reject

#### Combatant runtime actions

- [x] imported `runtimeActions` stable id / attack bonus / range / damage dice+flat+type 검증
- [x] atomic attack domain이 지원하는 `weapon | unarmed | wild-shape`만 허용
- [x] built-in Goblin = Scimitar +4 / 1d6+2 / 5 ft, Shortbow +4 / 1d6+2 / 80 ft
- [x] structured Combatant에 action contract가 없으면 legacy `+3 / 1d6+1` 가짜 공격 미생성

#### Pairwise spatial / targeting runtime

- [x] 공격 targeting에서 `SceneEntity.distance` 표시 문자열 제거
- [x] `sourceId => targetId` structured relation: distance / visibility / cover / mutual sight / provenance
- [x] reference scene Aelar ↔ existing enemies relation materialization
- [x] relation 없는 대상은 HP/Action 변경 없이 explicit reject
- [x] presentation distance drift가 authoritative distance에 영향 주지 않는 회귀 테스트

#### Damage / healing / dice

- [x] typed damage → resistance/vulnerability/immunity → Temporary HP → HP
- [x] save-half → typed defense → Temp HP → HP
- [x] healing → domain `resolveHealing`
- [x] generic fixed dice/formula primitive
- [x] structured healing: Second Wind / Healing Word / Healing Potion
- [x] Wand structured `3d4+3` force damage

#### 3D visual dice replay

- [x] `authoritativeDice` → presentation-only visual replay contract
- [x] d4/d6/d8/d10/d12/d20 CSS 3D/faceted renderer
- [x] attack/check/save/damage/healing replay
- [x] visual layer가 authoritative result를 생성/변경하지 않음
- [x] reduced-motion + Resolution cadence 호환
- [ ] optional WebGL/physics renderer

#### Atomic costs / ItemInstance

- [x] Action / Bonus Action / Reaction + class resource transactional commit/rollback
- [x] ItemInstance quantity/charges transactional resource projection
- [x] Potion = healing + Action + quantity **one domain transaction**
- [x] Wand = typed damage + Action + charge **one domain transaction**

#### Runtime turn / Combatant state

- [x] initiative order / round / active actor / HP / turn economy를 `RulesRuntimeState` session에 materialize
- [x] `beginTurn()` 기반 Action / Bonus Action / Reaction / movement reset
- [x] manual actor 선택은 spent economy를 reset하지 않음
- [x] round wrap은 base speed 복원
- [x] transitional Scene HP/economy 변경을 runtime에 reconcile
- [x] initiative 도중 Combatant instantiate → active runtime에 즉시 materialize
- [x] accepted interrupt Reaction을 **domain `reaction` operation으로 active turn runtime에 직접 commit**
- [x] Reaction event를 final attack event history에 합쳐 attack Undo가 defender Reaction까지 복원

#### ResolutionEvent / Activity / Undo

- [x] Shortbow raw `ResolutionEvent[]` → Activity → event-native Undo
- [x] Second Wind = healing + Bonus Action + class resource atomic events → Activity/Undo
- [x] Healing Potion = healing + Action + quantity atomic events → Activity/Undo
- [x] Wand = typed damage + Action + charge atomic events → Activity/Undo
- [x] Thunderwave = multi-target save + typed damage + Action **one atomic transaction** → Activity/Undo
- [x] generic event inverse: HP / economy / Character resource / ItemInstance quantity+charges
- [x] event `after`와 current state가 다르면 stale Undo explicit reject
- [x] event-native Undo 후 turn runtime reconcile

#### Representative E2E paths

- [x] Second Wind — `1d10+5` → atomic healing + Bonus Action + resource → event Activity/Undo
- [x] Thunderwave — runtime saves → per-target save-half/full typed damage + Action in one transaction → event Activity/Undo
- [x] Shortbow — canonical weapon + pairwise spatial → atomic attack → optional domain Reaction interrupt → event Activity/Undo
- [x] Healing Potion — `2d4+2` + quantity + Action in one transaction → event Activity/Undo
- [x] Wand — `3d4+3` typed force + charge + Action in one transaction → event Activity/Undo

### 현재 verified implementation checkpoint

```text
097100cf151aab395aae949eb989bddc3edc41c5
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

- [ ] movement command를 turn runtime 직접 command로 수렴
- [ ] movement/position 결과로 pairwise spatial relation을 갱신하는 application boundary 추가
- [ ] event-native Undo inverse를 effect / concentration / life state change까지 확대
- [ ] Combatant runtime action을 authoritative spatial facts가 있는 encounter instance에 확대
- [ ] Character Creation 전용 choice graph를 `ChoiceDefinition` 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] UI component에 named-rule 계산이 재유입되지 않는 구조 gate 추가
- [ ] optional WebGL/physics 3D dice renderer

Phase 09 완료 기준:

> 기존 화면 흐름을 유지하면서 대표 Character/Combatant 플레이 경로가 MockAdapter의 규칙 계산 없이 실제 rules domain을 사용하고, authoritative runtime/event state가 Activity와 Undo까지 일관되게 이어진다.

## Phase 10 — Persistence / Content Platform

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

## Phase 11 — Complete Offline Vertical Slice

- [ ] Character 생성 → finalize → 저장 → 재실행 후 복원
- [ ] 실제 SRD progression으로 level-up / multiclass
- [ ] equipment / ItemInstance / charges / resources 사용
- [ ] Freeform ability/save/action/spell/item resolution
- [ ] Initiative 시작 → order → turn economy → 종료
- [ ] attack / critical / typed damage / healing / conditions / Concentration
- [ ] reaction/interrupt decision flow
- [ ] class/subclass mechanics representative E2E
- [ ] Combatant import/review/instantiate → 실제 action resolution
- [ ] DM situational adjudication/correction
- [ ] authoritative activity/dice/provenance log
- [ ] safe Undo / correction / revision consistency
- [ ] 전체 offline walkthrough deterministic integration gate

## 구현 원칙

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. unsupported mechanic은 explicit blocker로 유지하고 silent approximation을 하지 않는다.
7. UI는 domain contract와 가능한 한 분리하고 named-rule 계산을 React에 넣지 않는다.
