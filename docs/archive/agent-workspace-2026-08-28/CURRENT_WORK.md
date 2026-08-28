# 현재 작업 체크리스트

> V1 실제 플레이/출시 작업의 canonical 실행 순서와 gate는 `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`를 따른다. 이 문서의 Phase 09 표기와 PR stack은 역사적 구현 문맥이며 현재 V1 다음 작업을 결정하지 않는다.

이 문서는 에이전트가 현재 우선순위와 다음 구현 Gate를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 역사적 상태

- [x] Rules Engine Phase 01-08 — executable rules foundation + canonical catalog/class mechanics
- [ ] Rules Engine Phase 09 — real mechanics integration / RealAdapter ← **current**
- [ ] Phase 10 — persistence / Content Platform
- [ ] Phase 11 — complete offline vertical slice

```text
Issue #53  app: converge Phase 09 mechanics into RealAdapter services
PR    #54  agent/53-mechanics-phase09
Owner progression regression stack:
PR    #60  agent/55-progression-choice-schedule-fix                DRAFT / Windows owner gate pending
PR    #62  agent/61-effect-concentration-runtime-undo               DRAFT
PR    #64  agent/63-authoritative-turn-runtime-attacks              DRAFT
PR    #66  agent/65-runtime-effect-activity-undo                    DRAFT
PR    #68  agent/67-spellcasting-authoritative-runtime              DRAFT / current stack head
```

## Phase 08 ✅

- 12개 SRD 클래스 × target level 2-20 outermost progression audit `catalog-pending` 0
- unsupported mechanic은 explicit reject
- stable ID + provenance + ChoiceDefinition + revision-checked commit
- Contract / Rules / progression aggregate / TypeScript / UI build green

Implementation checkpoint: `3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb`

## Owner progression gate — OPEN

- [x] production Vite route가 stale `LevelUpFocused`를 주입하던 원인 수정
- [x] Monk 1→2 phantom ASI 제거 자동 검증
- [x] Monk 2→3 required subclass choice 자동 검증
- [x] Monk 3→4 ASI schedule 자동 검증
- [x] 12 SRD classes × target levels 2-20 semantic choice schedule gate
- [x] Windows build / focused regression / Tauri / NSIS package green
- [ ] owner가 수정 Windows build에서 progression walkthrough 재검증

**owner 확인 전에는 PR #60을 ready/merge 처리하거나 progression acceptance gate를 닫지 않는다.**

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
- [x] `docs/design/README.md` design canon index에서 movement/module policy를 canonical 문서로 링크

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
- [x] shared TurnRuntimeSession registry + clone-only snapshot / revision-checked commit seam
- [x] initiative atomic attack이 실제 TurnRuntimeSession의 effects/concentration/history/combatants를 사용
- [x] staged attack 중 runtime revision drift 시 stale commit reject + intervening runtime mutation 보존
- [x] 실제 TurnRuntimeSession이 없으면 기존 isolated attack fallback 유지

#### Atomic representative actions
- [x] Shortbow = targeting + attack + damage + Action one transaction
- [x] Second Wind = healing + Bonus Action + class resource one transaction
- [x] Healing Potion = healing + Action + quantity one transaction
- [x] Wand = typed damage + Action + charge one transaction
- [x] Thunderwave = all target saves + per-target damage + Action one transaction
- [x] Manual Opportunity Attack = declared trigger facts + Reaction + attack + damage one transaction

#### Effect / Concentration runtime convergence
- [x] `EffectStateChange` safe inverse용 cloned before/after `EffectInstance` payload
- [x] `ConcentrationStateChange` groupId 문자열 대신 cloned full `ConcentrationState` before/after payload
- [x] start/end concentration, damage break, incapacitation/death, rest expiry에서 full state-change event 보존
- [x] event-native runtime inverse: Effect / Concentration drift-check + exact restore
- [x] runtime Undo는 revision을 과거로 되돌리지 않고 새로운 correction revision으로 +1
- [x] authoritative attack이 runtime-only damage effect를 실제 피해 계산에 반영
- [x] 집중 중 대상이 피해를 받고 fixed concentration-check input이 없으면 roll을 발명하지 않고 explicit reject
- [x] fixed failed concentration save는 concentration + group effects 제거 event를 기록
- [x] 일반 `apply/update/remove-effect`, `start/end-concentration` application service가 authoritative TurnRuntimeSession을 사용
- [x] effect/concentration application raw ResolutionEvent → Activity → shared event-native Undo
- [x] concentration Activity label은 `groupId (sourceId)`로 표시하고 `[object Object]` 누수 금지
- [x] 일반 effect application commit도 runtime revision drift를 덮어쓰지 않음
- [x] `SceneVm`에 effect/concentration 저장 필드를 추가하지 않음

#### Spellcasting runtime convergence
- [x] 실제 TurnRuntimeSession이 있을 때 executable spell cast가 authoritative RulesRuntimeState를 사용
- [x] legacy spell HUD slot pool은 runtime resource가 없을 때만 최초 materialization input으로 사용
- [x] authoritative slot resource는 반복 snapshot으로 legacy bridge 값에 덮어써지지 않음
- [x] Healing Word initiative path: slot + Bonus Action + HP + spellcasting-turn marker를 동일 runtime revision에서 commit
- [x] raw spell ResolutionEvent → generic Activity → shared event-native Undo
- [x] runtime-only spell-slot resource와 `{ turnId, slottedCasterIds }` marker를 drift-check / exact inverse
- [x] Undo 후 slot / Bonus Action / HP / HUD / turn-marker 복원 및 같은 turn 재시전 회귀 검증
- [x] 같은 turn 두 번째 slotted spell은 추가 slot 소비 없이 explicit reject
- [x] 실제 TurnRuntimeSession이 없는 spell action은 captured legacy spell bridge + 기존 2단계 safe Undo로 명시적 fallback
- [x] no-session non-spell action은 legacy fallback으로 우회하지 않고 전체 Phase 09 adapter chain 유지
- [x] canonical `src/domain/spellcasting.ts`가 attack/save/damage/healing/full-healing/condition/tracked effect를 동일 atomic Resolution로 compile
- [x] 339/339 catalog spell에 executable definition 존재 (`combat-executable` 117, `tracked-executable` 222, partial 0)
- [x] attack 10 + multi-attack 2 / save-damage 25 + compound 3 / save-effect 61 / healing 7 + full-healing 1 / temporary HP 1 / Power Word Kill 1 / projectile 1 자동 판정
- [x] 32개 주문의 표준 condition 적용·면역·지속시간·집중·피해 종료 lifecycle 연결
- [x] 25개 주문의 d20 advantage/disadvantage modifier 연결; 1회성 modifier는 사용한 굴림에서 event-native consume
- [x] 공간 모듈이 없을 때 area/multi-target 주문은 명시적으로 선택한 Scene actor 집합을 권위 대상으로 사용
- [x] 다중 타깃 선택 시 시전자→선택 Actor 카드 화살표를 타깃별로 고정하고 다음 선택용 커서 화살표 유지
- [x] 주문 condition effect를 `SceneEntity.status` 공개 배지로 투영하며 Host/Client event apply 및 Undo에서 동일 수명주기 사용
- [x] 나머지 world/scene interaction 주문도 승인 placeholder 없이 즉시 commit하며 target/action/slot/concentration/duration/effect summary를 권위 상태로 추적
- [x] `tests/domain/spellExecutionCoverage.test.ts`가 339 누락/partial 회귀와 대표 condition/modifier lifecycle을 차단
- [x] dedicated authoritative spellcasting CI gate 추가

#### ResolutionEvent / Activity / Undo
- [x] Shortbow / Second Wind / Potion / Wand / Thunderwave / manual Opportunity Attack raw events → Activity
- [x] event-native inverse: HP / economy / Character resource / ItemInstance quantity+charges / life flags
- [x] event-native inverse: EffectInstance / ConcentrationState
- [x] event-native inverse: runtime-only spell-slot resource / spellcasting-turn marker
- [x] critical wolf death `dead false→true` → Undo `true→false`
- [x] stale current state와 event `after` 불일치 시 explicit reject
- [x] event Undo 결과를 active turn runtime에 reconcile
- [x] attack / 일반 effect application / authoritative spellcasting이 shared raw-event history registry를 사용
- [x] pure runtime application용 generic Activity projector

#### 3D visual dice
- [x] authoritativeDice presentation-only replay
- [x] d4/d6/d8/d10/d12/d20 CSS 3D/faceted renderer
- [x] visual layer는 authoritative result를 생성/변경하지 않음
- [ ] optional WebGL/physics renderer

### 현재 verified implementation checkpoint

`ca0967a69d3525ce26df0e36ea5ba8ef68fd9c8b`

```text
Rules Domain                           ✅
Phase 08 zero-pending audit            ✅
Phase 07/08 aggregate progression      ✅
Phase 09 service/adapter tests         ✅
Authoritative turn-runtime attacks     ✅
Effect/Concentration runtime Undo      ✅
Effect application Activity/Undo       ✅
Authoritative spellcasting gate        ✅
339-spell executable coverage          ✅
Manual movement reaction E2E           ✅
Movement reaction UI/policy structure  ✅
3D dice tests                          ✅
TypeScript                             ✅
UI production build                    ✅
```

### 다음 Phase 09 작업

- [ ] condition/effect-aware turn begin semantics가 active runtime에 완전히 수렴하는지 검증 (`advanceTurnRuntimeSession` direct reset 제거)
- [ ] concentration damage save를 실제 사용자 입력/authoritative dice workflow와 연결; fixed input 없는 경우 explicit reject 유지
- [ ] Combatant runtime action을 authoritative spatial facts가 있는 encounter instance에 확대
- [ ] Character Creation choice graph를 `ChoiceDefinition` 경로로 점진 통합
- [ ] level-up / rest-time configuration / class-feature commands를 공용 application service로 수렴
- [ ] UI component에 named-rule 계산이 재유입되지 않는 구조 gate 추가
- [ ] optional WebGL/physics 3D dice renderer
- [ ] 실제 2D/3D 모듈 요구가 생길 때만 executable presentation-module loader/registration 설계; core movement ownership은 금지

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

## 2026-08-25 V1 D&D Session mechanics checkpoint

Owner scope: 식량·시간·휴식 **UI**는 별도 작업으로 분리한다. 이 묶음에서는 해당 UI를 변경하지 않는다.

### 이번 checkpoint에서 완료

- [x] mapless Actor-card 기회공격 선언 + Reaction/공격/피해 atomic commit + connected/Undo
- [x] Fighter Extra Attack attack-credit + Action Surge exact extra-Action/resource/connected/Undo
- [x] death save success/failure/natural 1/natural 20 + durable write-back/connected/Undo
- [x] Stabilize Medicine DC 10 + exact target/action/Undo
- [x] Unarmed Strike damage/grapple/shove-prone + public condition + mapless target + connected/Undo
- [x] Bardic Inspiration grant + Bonus Action/resource/public die marker + connected/Undo
- [x] Bardic Inspiration failed attack follow-up + private owner prompt + consume/decline + same attack commit + connected exactly-once/Undo
- [x] Fighter Tactical Mind on explicit-DC ability checks (Stabilize DC 10) + success-only Second Wind spend + private owner prompt + connected exactly-once/Undo
- [x] open ability-check Host public DC contract + six pure ability actions + 18 skill actions + connected/Undo
- [x] Fighter Tactical Mind on every eligible failed explicit-DC ability check + success-only Second Wind spend
- [x] Fighter Indomitable on failed saving throws + mandatory reroll/Fighter-level bonus/resource spend
- [x] projected remote Character saving throws resolve from the mounted owner sheet rather than the Host active sheet
- [x] Indomitable private owner prompt + multi-target sequential prompt + atomic damage/event history + connected exactly-once/Undo
- [x] Cleric Divine Spark heal/radiant/necrotic + freeform/initiative + Channel Divinity + connected/Undo
- [x] Cleric Turn Undead/Sear Undead + typed Undead multi-target + public conditions + connected/Undo
- [x] custom Combatant `creatureType` JSON validation and runtime fact projection
- [x] legacy/remote Fighter SessionProjection without Action Surge resource remains compatible; only unavailable action is omitted

### 검증

- [x] focused mechanics/domain/connected regression 47 tests green
- [x] Divine Spark domain/UI/connected 8 tests green
- [x] Turn Undead domain/UI/runtime stats 16 tests green
- [x] TypeScript `tsc --noEmit` green
- [x] production `npm run build` green (Windows `tsx os.userInfo` ENOMEM workaround applied only to the command)
- [x] rendered DM initiative preview: Actor boards, Action bar, Opportunity trigger, Extra Attack/Action Surge/Unarmed/Stabilize visible
- [x] Paladin action matrix aggregate: 48 focused domain/UI/connected tests green
- [x] post-Paladin production `npm run build`: creation 111 / rules domain 329 / campaign-rest 94 / Vite 500 modules green
- [x] post-follow-up production `npm run build`: creation 111 / rules domain 329 / campaign-rest 94 / Vite 503 modules green
- [x] open ability/DC full UI matrix 962/962 and focused post-preview regression 38/38 green
- [x] post-open-ability production `npm run build`: UI boundary 3 / creation 111 / rules domain 329 / campaign-rest 94 / Vite 505 modules green
- [ ] rendered DM preview interaction: HMR URL HTTP 200, but current in-app Browser localhost URL policy blocked click-path completion
- [x] Indomitable domain/local/remote-owner focused regression 16/16 green
- [x] post-Indomitable full UI matrix 965/965 green
- [x] post-Indomitable production `npm run build`: UI boundary 3 / creation 111 / rules domain 329 / campaign-rest 94 / Vite 508 modules green

### 다음 구현 순서

1. [x] Paladin Lay On Hands: arbitrary pool amount + condition removal command, freeform/initiative, owner write-back, connected/Undo
2. [x] Paladin Divine Sense: typed creature detection, freeform/initiative, Channel Divinity, connected/Undo
3. [x] Paladin Abjure Foes: mapless multi-target saves, public Frightened, Channel Divinity, connected/Undo
4. [x] failed attack follow-up: Bardic Inspiration consume/decline, private owner prompt, connected exactly-once, Undo
5. [x] explicit-DC failed ability check follow-up: Fighter Tactical Mind (Stabilize DC 10), success-only resource spend, connected/Undo
6. [x] open ability-check DM DC contract + Tactical Mind reuse
7. [x] failed saving-throw follow-up: Fighter Indomitable
8. [ ] remaining core class actions: Rage, Wild Shape, Monk Focus actions, Rogue Cunning/Uncanny paths
9. [ ] subclass action commands already backed by domain resolvers; expose only mechanics-complete actions
10. [ ] connected remote-owner matrix for every new action: host authority, public/private result, exactly-once, reconnect replay, Undo
11. [ ] non-food/time/rest full regression failures: distinguish stale structural expectations from actual runtime regressions, then repair
12. [ ] two-instance Tauri acceptance after the action matrix is complete
