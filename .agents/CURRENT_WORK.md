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

#### Spatial / targeting / optional movement module boundary
- [x] `SceneEntity.distance` presentation 문자열을 rules input에서 제거
- [x] `sourceId => targetId` structured distance/visibility/cover/sight/provenance
- [x] reference Aelar↔enemy relations materialization
- [x] missing relation은 Action/HP 변경 없이 reject
- [x] **Core SimpleVTT는 이동/격자/토큰 좌표/경로/LOS 시스템을 제공하지 않음**
- [x] `SimpleVttAdapter` / `MockAdapter` 기본 API에서 `moveActor` 제거
- [x] 2D grid / 3D scene / custom 모듈 공용 `MovementModuleCommand` + `MovementModuleHost` 계약
- [x] 모듈이 좌표/경로/거리/visibility/cover를 계산하고 complete pairwise post-move facts를 제출
- [x] module provenance를 spatial facts에 보존
- [x] Initiative에서 모듈이 요청할 경우 기존 domain `move` primitive로 이동력/제약 검증 가능
- [x] 갱신된 module spatial fact가 즉시 attack targeting에 반영되는 회귀 테스트
- [x] canonical policy: `docs/design/movement-modules.md`

#### Manual movement-triggered reactions
- [x] Core는 기회공격/이동 유발 반응을 자동 감지하지 않음
- [x] **현재 움직이는/provoking Actor를 조종하는 현재 턴 조종자**가 Scene의 `이동 반응 입력` 버튼으로 trigger를 명시적으로 선언
- [x] provoker/reactor/attack + trigger 순간 distance/visibility/cover/mutual-sight를 authoritative input으로 제출
- [x] Reaction availability / range / sight / cover / attack / critical / typed damage는 rules domain이 재검증
- [x] Reaction spend + attack을 하나의 atomic transaction으로 commit; targeting 실패 시 Reaction도 rollback
- [x] 반응 공격은 reactor의 일반 Action을 소비하지 않음
- [x] raw ResolutionEvent Activity + event-native Undo로 Reaction/HP/Temp HP 복원
- [x] future 2D/3D module trigger도 동일한 Reaction + attack boundary에 합류하도록 정책 고정
- [x] movement policy 문서 변경이 구조 테스트와 함께 CI를 재실행하도록 workflow dependency 고정

#### Damage / healing / life
- [x] typed damage resistance/vulnerability/immunity → Temp HP → HP
- [x] save-half → typed defense → Temp HP → HP
- [x] domain healing
- [x] structured dice: Second Wind / Healing Word / Potion / Wand
- [x] Scene runtime life projection: death saves / stable / unconscious / dead
- [x] Shortbow critical → monster 0 HP → `life.dead=true` projection

#### Turn runtime / interrupt
- [x] initiative order / round / active actor / HP / economy를 RulesRuntimeState session에 materialize
- [x] beginTurn 기반 Action / Bonus Action / Reaction / movement allowance reset
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
- [x] Manual Opportunity Attack = declared trigger facts + Reaction + attack + damage one transaction

#### ResolutionEvent / Activity / Undo
- [x] Shortbow / Second Wind / Potion / Wand / Thunderwave / manual Opportunity Attack raw events → Activity
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

`13d772e22d2d7f60ea08c95508c4c7869ad1c5ec`

```text
Contract validation                    ✅
Rules Domain                           ✅
Phase 08 zero-pending audit            ✅
Phase 07/08 aggregate progression      ✅
Phase 09 service/adapter tests         ✅
Manual movement reaction E2E           ✅
Movement reaction UI/policy structure  ✅
3D dice tests                          ✅
TypeScript                             ✅
UI production build                    ✅
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
- [ ] 실제 2D/3D 모듈 요구가 생길 때 executable presentation-module loader/registration 설계; core movement ownership은 금지

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
- [ ] initiative / turn economy (map/movement UI는 optional module)
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
8. **Core는 movement/map/coordinate 시스템을 소유하지 않는다.** 2D/3D 모듈은 coordinate-agnostic host contract를 통해 rules/spatial primitive만 재사용한다.
9. **Core는 movement-triggered reaction을 자동 감지하지 않는다.** 현재 턴 조종자의 수동 입력 또는 future movement module의 authoritative trigger fact를 동일한 Reaction/action transaction으로 검증한다.
