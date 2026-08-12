# 현재 작업 체크리스트

이 문서는 SimpleVTT 개발에서 에이전트가 현재 상태와 다음 작업을 빠르게 파악하기 위한 비공식 작업 체크리스트다.

- 공식 UX/설계 계약은 `docs/`, `schemas/`, `templates/`, `examples/`에 둔다.
- 구현 항목은 GitHub Issue로 구체화하고 전용 branch/Draft PR로 처리한다.
- 단기는 현재 설계 순서, 장기는 MVP 완료 조건 중심으로 유지한다.

## 제품 중심 원칙

SimpleVTT의 목표는 **D&D에서 사람이 직접 해야 하는 산수와 규칙 상태 추적을 최대한 줄이는 것**이다.

- 수학은 자동화하고 실제 선택은 플레이어/DM에게 남긴다.
- 모든 주요 계산값은 `최종값 + RuleSource별 provenance`로 설명 가능해야 한다.
- feat/spell/equipment/condition/class feature 등은 설명문이 아니라 구조화된 mechanics를 제공한다.
- `RuleSource + Property + Expression + Predicate + Timing + Action/Effect/Resource/Permission/Restriction`을 공통 규칙 언어로 사용한다.
- 기본 룰 콘텐츠와 홈브루 콘텐츠는 동일한 validation/rules pipeline을 사용한다.
- deterministic grant는 자동 적용하고 실제 선택이 필요한 경우에만 `ChoiceDefinition`을 표시한다.
- Character builder는 활성 `ContentCatalog`를 조회하며 named rule content를 React에 하드코딩하지 않는다.
- RuleModule은 portable content이고 `builtin | local | session`은 install/mount scope다.
- 단일 feat JSON과 대형 RuleModule은 같은 catalog/RuleSource 형식으로 정규화한다.
- 행동경제와 resource 상태는 RulesProfile이 정의하는 실제 rules state이며 Resolution transaction/Undo 대상이다.
- Character 원본은 플레이어 로컬에 있고 DM은 session projection과 shared session state만 소유한다.
- Character 생성/레벨업은 source 선택을 저장하고 derived total은 RulesProfile + RuleSource graph로 재계산한다.
- 레벨업은 `ProgressionDraft → 자동 grant/Choice 해결 → diff review → Character revision commit`으로 처리한다.
- 세션은 `Freeform/Exploration`과 `Initiative/Structured`를 구분하되 두 모드가 같은 rules/resolution engine을 사용한다.
- Freeform에서는 turn economy를 무한히 spent 상태로 유지하지 않지만 resource/HP/effect/Predicate/Timing은 계속 추적한다.
- 휴식/여행/다운타임은 우선 별도 mode가 아니라 Freeform Activity로 처리한다.
- Import된 Character/Combatant/rule/module data는 선언형 데이터이며 arbitrary executable code를 허용하지 않는다.

## 현재 GitHub 상태

- [x] Issue #1 / Draft PR #2 — 에이전트 작업 공간 분리
- [x] Issue #3 / Draft PR #4 — Combat Automation UX / Combatant Import 계약
- [x] Issue #5 / Draft PR #6 — Character 생성/편집 UX
- [x] Issue #7 / Draft PR #10 — RuleSource provenance / action economy
- [x] Issue #11 / Draft PR #12 — RuleModule / ContentCatalog / ChoiceDefinition
- [x] Issue #13 / Draft PR #15 — Character progression / level-up
- [x] Issue #14 — Freeform Exploration / Initiative session modes
- [x] `agent/14-session-modes-exploration` stacked branch 생성
- [x] `docs/design/session-modes-exploration-initiative.md` 초안 작성
- [x] 실수로 생성된 Issue #8/#9는 #7 duplicate로 종료
- [ ] Issue #14 Draft PR 생성 및 설계 리뷰
- [ ] PR #2부터 선행 stacked PR을 순서대로 review/merge/retarget
- [ ] 공통 Rule Definition Specification 문서 트리 작성
- [ ] 초기 D&D RulesProfile 확정
- [ ] 설계 계약 안정화 후 첫 코드 구현 Issue 시작

## 단기 체크리스트

### 1. 선행 stacked PR 정리

- [ ] PR #2 review → `main` merge
- [ ] PR #4를 `main`으로 retarget하고 diff 재검증
- [ ] 이후 PR #6 → #10 → #12 → #15 → #14 PR 순으로 dependency 정리
- [ ] 각 PR은 retarget 후 자기 Issue 범위만 남는지 compare/diff 확인

### 2. Combat Automation — Issue #3 / PR #4

- [x] Character / Combatant / Action / Effect / Resolution 경계
- [x] authoritative dice result와 visual dice 분리
- [x] compact + expandable roll/activity log 방향
- [x] Combatant JSON schema/template/example/AI authoring path 초안
- [ ] `CombatEvent`를 Freeform까지 포괄하는 `ResolutionEvent/GameEvent` 계열로 일반화할지 확정
- [ ] RuleSource/module/session-mode 계약에 맞춘 Combatant schema migration 방향 확정
- [ ] Resolution interrupt/timing ordering 확정
- [ ] JSON Schema/example 자동 validation 계획 확정

### 3. Character Authoring — Issue #5 / PR #6

- [x] Guided Creation / Quick Create가 동일 draft 사용
- [x] autosave/resume/final review/validation UX
- [x] source/derived/override 표시 원칙
- [x] Character 작성 결과가 바로 rules/combat-ready여야 하는 원칙
- [ ] Character source selection/RuleSource ownership 계약 정합성 검토
- [ ] ContentCatalog/ChoiceDefinition 기반 picker/grant UX 정합성 검토
- [ ] Progression/Level Up 진입점과 동일 section mental model 연결
- [ ] 초기 RulesProfile 확정 후 실제 guided step/필수 필드 확정

### 4. RuleSource / Provenance / Action Economy — Issue #7 / PR #10

- [x] RuleSource mechanic family
- [x] dependency/provenance graph
- [x] applied/suppressed/superseded/failed-predicate 설명
- [x] explicit override RuleSource
- [x] RulesProfile-driven economy ledger / Action legality / resource cost
- [x] reaction/interrupt와 transaction/Undo 연계
- [ ] stable Property path registry
- [ ] restricted Expression AST 최소 집합
- [ ] Predicate AST 최소 집합
- [ ] Timing/Event point registry 최소 집합
- [ ] Duration/lifecycle 최소 집합
- [ ] stacking/priority/stable rule ID
- [ ] MVP Mechanic primitive 최소 집합

### 5. Rule Modules / Content Catalog — Issue #11 / PR #12

- [x] portable RuleModule + builtin/local/session mount scope
- [x] manifest/version/dependency/conflict 요구사항
- [x] stable qualified content identity (`module + source`)
- [x] ContentCatalog 기반 Character builder
- [x] automatic grant와 first-class ChoiceDefinition
- [x] progression/predicate 기반 grant activation
- [x] single feat JSON import → module-backed catalog content
- [x] session module temporary mount / local library 보호
- [x] load-order가 아닌 explicit conflict/replacement 원칙
- [x] session compatibility negotiation 요구사항
- [ ] manifest serialization 초안
- [ ] module/source ID naming convention
- [ ] ChoiceDefinition을 공통 Rule Specification으로 승격
- [ ] module replacement/extension semantics
- [ ] unknown player-local source에 대한 기본 DM review 정책

### 6. Character Progression / Level Up — Issue #13 / PR #15

- [x] progression을 source-data transaction으로 정의
- [x] RulesProfile-driven ProgressionTrack 개념
- [x] ProgressionDraft autosave/cancel/commit
- [x] deterministic progression grants 자동 적용
- [x] 새로운 ChoiceDefinition만 사용자에게 노출
- [x] source-by-source before/after review
- [x] HP/resource max 변화 시 RulesProfile policy 요구
- [x] superseded RuleSource provenance
- [x] Character revision/history 최소 요구사항
- [x] active-session progression compatibility 정책
- [ ] 초기 RulesProfile의 실제 progression tracks/threshold semantics 확정
- [ ] Character schema에서 progression selections/revision metadata 위치 확정
- [ ] respec/retraining MVP 경계 최종 확정

### 7. Session Modes / Exploration / Initiative — Issue #14

- [x] `Freeform/Exploration`과 `Initiative/Structured` 구분
- [x] Freeform에서도 Action/Resource/Effect/Predicate/Timing/Resolution을 동일하게 사용
- [x] Freeform action-economy policy를 RulesProfile 책임으로 정의
- [x] 공격/주문 사용이 자동으로 Initiative를 강제하지 않는 원칙
- [x] mode-aware Predicate context
- [x] turn-relative Timing이 Freeform에서 임의 해석되지 않는 원칙
- [x] 최소 logical session/world-time 추상화
- [x] Freeform → Initiative state transition 요구사항
- [x] Initiative → Freeform state transition 요구사항
- [x] 휴식/여행/다운타임을 Freeform Activity로 우선 처리
- [x] DM host가 authoritative SessionMode/InitiativeState를 소유
- [x] activity log/event model을 exploration까지 일반화하는 방향
- [ ] SessionMode/InitiativeState serialization 초안
- [ ] Freeform economy policy의 초기 RulesProfile 실제 규칙 확정
- [ ] logical time advance semantics와 Duration contract 정합성 확정
- [ ] generalized ResolutionEvent naming/shape 확정
- [ ] Issue #14 Draft PR 생성 및 설계 리뷰

### 8. Common Rule Definition Specification — 다음 핵심 설계

현재 분산된 계약을 하나의 버전 규격 트리로 승격한다.

- [ ] `docs/rules/README.md` — versioning / invariant / glossary
- [ ] RuleSource
- [ ] Properties / property paths
- [ ] Mechanics
- [ ] Expressions
- [ ] Predicates
- [ ] Events / Timing / Triggers
- [ ] Duration / lifecycle / logical time
- [ ] Actions / action economy / legality
- [ ] Resources
- [ ] Targeting / Scope
- [ ] ChoiceDefinition
- [ ] ProgressionTrack / progression grants
- [ ] SessionMode / initiative lifecycle
- [ ] Provenance
- [ ] Validation / unsupported mechanics
- [ ] RuleModule / ContentCatalog
- [ ] RulesProfile
- [ ] ResolutionEvent transaction / Undo
- [ ] 대응 JSON Schema + example set

### 9. 초기 RulesProfile

공통 규격 v0.x가 정리된 뒤 첫 실제 D&D profile을 만든다.

- [ ] profile ID/version
- [ ] Property registry
- [ ] derived formulas / stacking rules
- [ ] Predicate/Timing/Duration semantics
- [ ] action-economy buckets
- [ ] Freeform economy policy
- [ ] Initiative lifecycle/reset ordering
- [ ] progression tracks/thresholds
- [ ] validation rules
- [ ] 최소 default content module과 연동

### 10. 첫 구현 Vertical Slice

공통 규격 + 초기 RulesProfile 뒤에 시작한다.

- [ ] Tauri + React + TypeScript 초기화
- [ ] UI와 rules/domain package 분리
- [ ] lint/typecheck/test/build + GitHub Actions
- [ ] default module 기반 Character create
- [ ] automatic grants + required choices
- [ ] local feat JSON import
- [ ] Character progression draft 1회
- [ ] provenance-aware derived property
- [ ] Freeform skill/action resolution
- [ ] Initiative 시작/종료
- [ ] action economy / resource / target / attack resolution
- [ ] shared ResolutionEvent log + Undo

## 장기 체크리스트

### Phase 0 — Repository / CI

- [ ] `main` 항상 실행 가능
- [ ] Issue → branch → Draft PR → review/CI → merge 정착
- [ ] stacked PR retarget/diff 검증 습관화
- [ ] 기본 CI 정착

### Phase 1 — Rule Specification / RulesProfile

- [ ] Common Rule Definition Specification v0.x
- [ ] Predicate / Timing / Duration / logical time
- [ ] RuleSource / provenance / action economy
- [ ] RuleModule / ContentCatalog / ChoiceDefinition
- [ ] ProgressionTrack / Character revision
- [ ] SessionMode / Initiative lifecycle
- [ ] initial D&D RulesProfile
- [ ] structural + semantic validation / unsupported policy

### Phase 2 — Offline Character / Rule Content

- [ ] Guided/Quick Create + draft recovery
- [ ] default module catalog
- [ ] deterministic grants + required choices
- [ ] local RuleSource/RuleModule import
- [ ] Level Up / ProgressionDraft
- [ ] source-by-source stat breakdown
- [ ] Character export/import/versioning/recovery
- [ ] DM Combatant library + JSON import

### Phase 3 — Freeform Rules Play

- [ ] Freeform checks/Actions without initiative
- [ ] resource/effect/HP transactions
- [ ] logical time + Activity (rest/travel/time advance)
- [ ] shared activity/roll log
- [ ] safe Undo

### Phase 4 — Initiative / Resolution Engine

- [ ] Initiative participants/order/turn/round
- [ ] action economy / legality / reactions
- [ ] authoritative dice
- [ ] attack/save/damage/healing/effects
- [ ] resistance/immunity/vulnerability/critical/temp HP
- [ ] interrupt `awaiting_choice`
- [ ] Freeform ↔ Initiative transition preservation

### Phase 5 — LAN / Hamachi / Session Modules

- [ ] DM PC host / LAN/Hamachi connection
- [ ] Character 원본 player-local 유지
- [ ] RulesProfile/module/source compatibility negotiation
- [ ] session module temporary mount
- [ ] SessionMode/ResolutionEvent/choice/reaction sync
- [ ] reconnect/dedupe/resync

### Phase 6 — Stability / Distribution

- [ ] schema/module/Character migration
- [ ] broken reference/cycle/invalid mechanic diagnostics
- [ ] module dependency/conflict diagnostics
- [ ] Windows distribution
- [ ] 실제 다인 LAN/Hamachi 플레이 검증

## MVP 완료 조건

- [ ] 플레이어가 세션 없이 Character 생성/수정/저장/레벨업 가능
- [ ] 기본 module이 build 선택을 제공하고 deterministic feature는 자동 부여
- [ ] 실제 선택만 ChoiceDefinition으로 질문
- [ ] 단일 homebrew feat JSON을 local catalog에 추가 가능
- [ ] 주요 계산값이 RuleSource/provenance로 설명됨
- [ ] feat/spell/item/condition의 mechanics가 Predicate/Timing 포함 구조화 데이터로 관리됨
- [ ] Freeform에서 initiative 없이 check/spell/item/healing/effect 등을 정상 처리 가능
- [ ] resource/HP/effect는 Freeform에서도 정확히 지속/소비됨
- [ ] DM이 Initiative를 시작/종료할 수 있고 persistent state가 모드 전환에서 보존됨
- [ ] action economy/resource/action legality가 Initiative에서 자동 추적됨
- [ ] Combatant JSON/session module을 DM이 검증/활성화 가능
- [ ] 플레이어/DM RulesProfile/module/source 호환성을 세션 전에 판단 가능
- [ ] 공격/세이브/typed damage/critical/resistance/temp HP 핵심 계산 자동화
- [ ] visual dice, calculation/provenance, state changes가 같은 ResolutionEvent를 기반으로 함
- [ ] 안전한 Undo가 HP/resource/economy/effect를 일관되게 복구
- [ ] 같은 Wi-Fi/Hamachi에서 shared mode/state/result가 일관되게 동기화

## MVP 이후 후보

- LAN session 자동 발견
- 최근 DM 주소 기억
- GM PIN/session access control
- 더 많은 dice syntax / mechanic primitive
- richer module authoring/export UX
- module/Character migration assistant
- 선택적 session log export/import
- richer calendar/travel/downtime tooling
- Character/Combatant backup/recovery 개선
- 외부 AI RuleSource/RuleModule authoring 보조

## 의도적으로 제외

- 클라우드 계정/중앙 Character 서버
- marketplace/package registry
- 자동 Internet module download
- arbitrary executable rule scripts
- 채팅/음성
- 전투 맵/토큰/fog of war
- campaign wiki
- 대규모 독점 rules database 번들
- 앱 내부 AI 모델 의존
- 범용 Foundry VTT 대체 기능
