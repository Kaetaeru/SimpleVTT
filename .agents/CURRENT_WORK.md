# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위와 다음 구현 Gate를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] Rules Engine Phase 01-08 — executable rules foundation + canonical catalog/class mechanics
- [ ] Rules Engine Phase 09 — real mechanics integration / RealAdapter ← **current**
- [ ] Phase 10 — persistence / Content Platform
- [ ] Phase 11 — complete offline vertical slice

```text
Issue #53  app: converge Phase 09 mechanics into RealAdapter services
PR    #54  agent/53-mechanics-phase09
Base       agent/50-rules-phase08 (PR #52)
```

## Phase 08 ✅

- 12개 SRD 클래스 × target level 2-20 outermost progression audit `catalog-pending` 0
- unsupported mechanic은 explicit reject
- stable ID + provenance + ChoiceDefinition + revision-checked commit
- Contract / Rules / progression aggregate / TypeScript / UI build green

Implementation checkpoint: `3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb`

## Phase 09 — Mechanics Integration / RealAdapter ← current

목표: MockAdapter-owned 규칙 계산을 공용 application/domain/runtime/event 경계로 수렴시키고, UI contract는 유지한다.

### 완료된 integration cluster

#### D20 / runtime stats
- [x] target/DC를 발명하지 않는 open-D20
- [x] attack natural 1/20 canonical semantics
- [x] Character save = ability + PB + canonical class save proficiency
- [x] built-in/imported Combatant structured ability/PB/save/speed/typed defense
- [x] missing stat은 guess 없이 reject

#### Combatant runtime actions
- [x] imported runtimeActions stable id / bonus / range / damage contract
- [x] supported source kind `weapon | unarmed | wild-shape`
- [x] built-in Goblin exact Scimitar/Shortbow runtime actions
- [x] structured Combatant에 fake `+3 / 1d6+1` fallback 미생성

#### Spatial / targeting / movement
- [x] `SceneEntity.distance` presentation 문자열을 rules input에서 제거
- [x] `sourceId => targetId` structured distance/visibility/cover/sight/provenance
- [x] reference Aelar↔enemy relations materialization
- [x] missing relation은 Action/HP 변경 없이 reject
- [x] `moveActor` application command → active turn runtime `move` operation
- [x] tracked actor relation 전체 post-move set을 요구; 부분 spatial update면 movement 자체 reject
- [x] movement commit 후 pairwise relations 갱신
- [x] 갱신된 90ft fact가 즉시 Shortbow out-of-range 판정에 사용되는 회귀 테스트

#### Damage / healing / life
- [x] typed damage resistance/vulnerability/immunity → Temp HP → HP
- [x] save-half → typed defense → Temp HP → HP
- [x] domain healing
- [x] structured dice: Second Wind / Healing Word / Potion / Wand
- [x] Scene runtime life projection: death saves / stable / unconscious / dead
- [x] Shortbow critical → monster 0 HP → `life.dead=true` projection

#### Turn runtime / interrupt
- [x] initiative order / round / active actor / HP / economy를 RulesRuntimeState session에 materialize
- [x] beginTurn 기반 Action / Bonus Action / Reaction / movement reset
- [x] manual actor selection은 spent economy를 reset하지 않음
- [x] dynamic Combatant instantiate → active runtime에 즉시 materialize
- [x] accepted interrupt → domain `reaction` operation
- [x] Reaction event를 attack history에 합쳐 Undo가 defender Reaction까지 복원

#### Atomic representative actions
- [x] Shortbow = targeting + attack + damage + Action one transaction
- [x] Second Wind = healing + Bonus Action + class resource one transaction
- [x] Healing Potion = healing + Action + quantity one transaction
- [x] Wand = typed damage + Action + charge one transaction
- [x] Thunderwave = all target saves + per-target damage + Action one transaction

#### ResolutionEvent / Activity / Undo
- [x] Shortbow / Second Wind / Potion / Wand / Thunderwave raw events → Activity
- [x] event-native inverse: HP / economy / Character resource / ItemInstance quantity+charges / life flags
- [x] critical wolf death `dead false→true` → Undo `true→false`
- [x] stale current state와 event `after` 불일치 시 explicit reject
- [x] event Undo 결과를 active turn runtime에 reconcile

#### 3D visual dice
- [x] authoritativeDice presentation-only replay
- [x] d4/d6/d8/d10/d12/d20 CSS 3D/faceted renderer
- [x] visual layer는 authoritative result를 생성/변경하지 않음
- [ ] optional WebGL/physics renderer

### 현재 verified implementation checkpoint

`92cd8a21711ddc415ec6a4b1c9c9fa8f516dacb1`

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

- [ ] EffectStateChange에 safe inverse용 before/after effect payload 추가
- [ ] concentration runtime projection + event-native inverse
- [ ] effect/concentration application path를 raw event Activity/Undo에 연결
- [ ] Combatant runtime action을 authoritative spatial facts가 있는 encounter instance에 확대
- [ ] Character Creation choice graph를 `ChoiceDefinition` 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] UI component에 named-rule 계산이 재유입되지 않는 구조 gate 추가
- [ ] optional WebGL/physics 3D dice renderer

Phase 09 완료 기준:

> 기존 화면 흐름을 유지하면서 대표 Character/Combatant 플레이 경로가 MockAdapter의 규칙 계산 없이 실제 rules domain을 사용하고, authoritative runtime/event state가 Activity와 Undo까지 일관되게 이어진다.

## Phase 10 — Persistence / Content Platform

- [ ] local Character library persistence
- [ ] durable runtime/content revision 저장
- [ ] draft persistence + recovery
- [ ] real ContentCatalog + builtin/local/homebrew composition
- [ ] module dependency/version/capability/cycle/conflict validation
- [ ] local homebrew import → validation → review → activation
- [ ] ItemInstance / spellbook / resource / feature state persistence
- [ ] atomic local save + failed-save recovery

## Phase 11 — Complete Offline Vertical Slice

- [ ] Character 생성/저장/복원
- [ ] progression / multiclass
- [ ] equipment / ItemInstance / resources
- [ ] Freeform ability/save/action/spell/item resolution
- [ ] initiative / turn economy / movement
- [ ] attack / damage / healing / conditions / Concentration
- [ ] reaction/interrupt flow
- [ ] class/subclass representative E2E
- [ ] Combatant import/instantiate/action resolution
- [ ] DM adjudication/correction
- [ ] authoritative activity/dice/provenance
- [ ] safe Undo / revision consistency
- [ ] offline walkthrough deterministic gate

## 구현 원칙

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. unsupported mechanic은 explicit blocker로 유지한다.
7. UI에 named-rule 계산을 넣지 않는다.
