# 현재 작업 체크리스트

이 문서는 SimpleVTT 개발에서 에이전트가 현재 상태와 다음 작업을 빠르게 파악하기 위한 비공식 작업 체크리스트다.

- 공식 UX/설계 계약은 `docs/`, `schemas/`, `templates/`, `examples/`에 둔다.
- 구현에 들어가는 항목은 GitHub Issue로 구체화하고 전용 branch/PR로 처리한다.
- 단기는 현재와 다음 몇 개 PR의 실행 순서, 장기는 MVP의 완료 조건 중심으로 유지한다.

## 제품 중심 원칙

SimpleVTT의 핵심 목표는 **전투에서 사람이 해야 하는 산수와 규칙 상태 추적을 압도적으로 줄이는 것**이다.

- 수학은 자동화하고 실제 선택은 플레이어/DM에게 남긴다.
- 모든 주요 계산값은 `최종값 + RuleSource별 provenance`로 설명 가능해야 한다.
- feat/spell/equipment/condition/class feature 등은 설명문이 아니라 구조화된 mechanics를 제공한다.
- `RuleSource + Predicate + Timing + Action/Effect/Resource/Permission/Restriction`을 공통 규칙 언어로 사용한다.
- 행동경제와 resource 상태는 RulesProfile이 정의하는 실제 encounter state이며 CombatEvent/Undo에 포함한다.
- Character 원본은 플레이어 로컬에 있고 DM은 session projection과 encounter state만 소유한다.
- Character 생성은 source 선택을 저장하고 derived total은 RulesProfile + RuleSource graph로 재계산한다.
- 기본 룰 콘텐츠와 홈브루 콘텐츠는 같은 mechanics pipeline을 사용한다.
- Character builder는 이름이 박힌 UI 목록이 아니라 활성 `ContentCatalog`를 조회한다.
- deterministic grant는 자동 적용하고 실제 선택이 필요한 경우에만 `ChoiceDefinition`을 표시한다.
- 단일 feat JSON과 대형 RuleModule은 같은 catalog/validation/rule engine으로 정규화한다.
- RuleModule은 portable content이고 `builtin | local | session`은 설치/mount scope다.
- session module은 플레이어 로컬 라이브러리를 자동으로 덮어쓰거나 영구 설치하지 않는다.
- Import된 Character/Combatant/rule/module data는 선언형 데이터이며 arbitrary executable code를 허용하지 않는다.

## 현재 GitHub 상태

- [x] Issue #1 / Draft PR #2 — 에이전트 작업 공간 분리
- [x] Issue #3 / Draft PR #4 — 전투 자동화 UX 및 Combatant Import 계약
- [x] Issue #5 / Draft PR #6 — Character 생성/편집 UX
- [x] Issue #7 / Draft PR #10 — RuleSource provenance 및 action economy
- [x] Issue #11 — RuleModule / ContentCatalog / automatic grant / ChoiceDefinition 설계
- [x] `agent/11-rule-modules-content-packs` stacked branch 생성
- [x] `docs/design/rule-modules-content-packs.md` 초안 작성
- [x] 실수로 생성된 Issue #8/#9는 #7 duplicate로 종료
- [ ] PR #2부터 선행 stacked PR을 순서대로 검토/merge/retarget
- [ ] Issue #11 Draft PR 생성 및 설계 리뷰
- [ ] 공통 Rule Definition Specification의 하위 명세 구조 확정
- [ ] 초기 D&D RulesProfile 확정
- [ ] 설계 계약이 안정된 뒤 첫 코드 구현 Issue 시작

## 단기 체크리스트

### 1. 저장소 흐름 정리 — Issue #1 / PR #2

- [x] `.agents/` 경계와 current-work checklist 도입
- [ ] PR #2 최종 검토 후 `main` merge
- [ ] merge 후 dependent PR base 정리

### 2. Combat Automation 계약 — Issue #3 / PR #4

- [x] Character / Combatant Definition / Combatant State / Action / Effect / Resolution / CombatEvent 경계
- [x] authoritative dice result와 visual dice 분리
- [x] Roll20/FVTT형 compact + expandable combat log UX
- [x] Combatant JSON schema/template/example/AI authoring path 초안
- [ ] Issue #7/#11 계약에 맞춰 Combatant schema migration 방향 검토
- [ ] JSON Schema/example 자동 validation 추가 계획 확정
- [ ] Resolution interrupt/timing ordering 확정
- [ ] PR #4 리뷰

### 3. Character Authoring UX — Issue #5 / PR #6

- [x] Guided Creation / Quick Create가 동일 Character draft 사용
- [x] autosave/resume/final review/validation UX
- [x] source/derived/override 표시 원칙
- [x] Character 작성 결과가 바로 combat-ready여야 하는 원칙
- [ ] Character가 flattened total이 아니라 source selection/RuleSource를 소유하도록 #7과 정합성 검토
- [ ] Character builder가 #11 ContentCatalog/ChoiceDefinition을 사용하도록 설계 정합성 검토
- [ ] 초기 RulesProfile 확정 후 실제 guided steps/필수 필드 확정
- [ ] PR #6 리뷰

### 4. RuleSource / Provenance / Action Economy — Issue #7 / PR #10

- [x] RuleSource mechanic family 초안
- [x] property dependency/provenance graph
- [x] applied/suppressed/superseded/failed-predicate 설명 모델
- [x] explicit override를 RuleSource로 취급
- [x] restricted expression/predicate + arbitrary code 금지
- [x] RulesProfile-driven economy ledger
- [x] Action legality / economy-resource cost / reset / reaction integration
- [x] CombatEvent transaction/Undo에 economy/resource 포함
- [ ] 공통 Property path registry 구조 확정
- [ ] Predicate AST 최소 연산 집합 확정
- [ ] Timing/Event point registry 최소 집합 확정
- [ ] stacking/priority/stable rule ID 규칙 확정
- [ ] MVP mechanic primitive 정확한 최소 집합 확정
- [ ] PR #10 리뷰

### 5. Rule Modules / Content Packs / Choices — Issue #11

- [x] built-in/default, local/personal, session/server scope 정의
- [x] scope를 portable module이 아니라 install/mount context에 두는 원칙 정의
- [x] RuleModule manifest/version/dependency/conflict 요구사항 정의
- [x] stable qualified source ID (`module + source`) 원칙 정의
- [x] ContentCatalog가 Character builder의 선택 데이터를 제공하는 구조 정의
- [x] deterministic automatic grant와 first-class `ChoiceDefinition` 구분
- [x] choice selection을 Character source data로 저장하는 원칙 정의
- [x] progression/predicate 기반 grant/choice activation 정의
- [x] 단일 feat JSON import를 module-backed content로 정규화하는 UX 정의
- [x] DM session module은 temporary mount이고 local library를 자동 변경하지 않는 원칙 정의
- [x] module conflict는 load-order가 아니라 explicit dependency/replacement 관계로 처리
- [x] session join 시 RulesProfile/module/source identity compatibility negotiation 요구사항 정의
- [ ] module manifest 정확한 serialization 초안
- [ ] module/source ID naming convention 확정
- [ ] ChoiceDefinition schema/semantics를 공통 Rule Specification으로 승격
- [ ] module replacement/extension semantics 확정
- [ ] session에서 unknown player-local source를 처리할 기본 정책 확정
- [ ] standalone import를 global user module로 둘지 per-import mini module로 둘지 확정
- [ ] Issue #11 Draft PR 생성 및 설계 리뷰

### 6. 공통 Rule Definition Specification — 후속 설계 PR

Issue #7/#11에서 나온 공통 언어를 하나의 규격 트리로 승격한다.

- [ ] `docs/rules/README.md` — 규격 목차/버전/핵심 invariant
- [ ] RuleSource
- [ ] Properties / property paths
- [ ] Mechanics
- [ ] Expressions
- [ ] Predicates
- [ ] Events / Timing / Triggers
- [ ] Actions / action economy
- [ ] Resources
- [ ] Targeting / Scope
- [ ] Duration / lifecycle
- [ ] ChoiceDefinition
- [ ] Provenance
- [ ] Validation / unsupported mechanics
- [ ] RuleModule / ContentCatalog
- [ ] RulesProfile
- [ ] 대응 JSON Schema와 최소 example set 계획

### 7. 애플리케이션 골격 + 순수 도메인 패키지 — 후속 구현 PR

공통 규격과 초기 RulesProfile이 정리된 뒤 시작한다.

- [ ] Tauri + React + TypeScript 초기화
- [ ] UI와 rules/domain 코드를 분리
- [ ] React component 내부에서 핵심 rules arithmetic 금지
- [ ] RulesProfile / RuleSource / Property / Predicate / Timing / Module / Catalog / Choice / Economy / Resolution / Event 패키지 경계
- [ ] Character/DM Host 기본 라우팅
- [ ] lint/typecheck/test/build
- [ ] PR GitHub Actions 최소 CI

### 8. 첫 오프라인 Vertical Slice — 후속 구현 PR

네트워크 전 단계에서 한 캐릭터 작성과 한 전투 계산을 end-to-end로 통과시킨다.

- [ ] default module에서 class/species 선택
- [ ] deterministic grant 자동 부여
- [ ] `choose 1 of N` ChoiceDefinition 해결
- [ ] local feat JSON import 후 Character builder에서 선택
- [ ] Character source graph/provenance 재계산
- [ ] Action legality/economy/resource 표시
- [ ] target 선택 → attack Resolution
- [ ] attack/AC/critical/typed damage/resistance/temp HP 자동 계산
- [ ] 동일 provenance로 Character detail과 combat log 설명
- [ ] CombatEvent + Undo로 HP/resource/economy 함께 복구

## 장기 체크리스트

### Phase 0 — Repository / CI

- [ ] `main`은 항상 실행 가능한 상태 유지
- [ ] Issue → branch → Draft PR → review/CI → merge 흐름 정착
- [ ] stacked PR은 선행 merge 후 즉시 retarget/diff 재검증
- [ ] lint/typecheck/test/build CI 정착

### Phase 1 — Rule Specification / RulesProfile

- [ ] 공통 Rule Definition Specification v0.x
- [ ] 초기 D&D RulesProfile
- [ ] stable property/timing/mechanic/predicate registry
- [ ] provenance + stacking/priority
- [ ] RuleModule/ContentCatalog/ChoiceDefinition
- [ ] structural + semantic validation
- [ ] unsupported mechanics 정책

### Phase 2 — Offline Character / Content Library

- [ ] Guided/Quick Create + draft recovery
- [ ] built-in module catalog 기반 Character creation
- [ ] deterministic grants + required choices
- [ ] local single RuleSource JSON import
- [ ] local RuleModule import/enable/disable
- [ ] source-by-source derived value breakdown
- [ ] Character export/import/versioning
- [ ] DM Combatant library + validated JSON import

### Phase 3 — Rules / Resolution Engine

- [ ] dependency graph property resolution
- [ ] Predicate/Timing/Trigger evaluation
- [ ] action economy / legality / resources
- [ ] authoritative dice
- [ ] attack/save/damage/healing/effects
- [ ] resistance/immunity/vulnerability/critical/temp HP
- [ ] reaction/interrupt `awaiting_choice`
- [ ] CombatEvent transaction + Undo

### Phase 4 — Combat UX / Dice / Log

- [ ] action/economy/status 중심 player surface
- [ ] visual dice renders authoritative result
- [ ] compact + expandable combat log
- [ ] `왜 +N인가`, `왜 적용 안 됐나`, `왜 지금 못 쓰나`를 UI에서 설명

### Phase 5 — LAN / Hamachi / Session Modules

- [ ] DM PC session host
- [ ] LAN/Hamachi 동일 연결 모델
- [ ] Character 원본은 player-local 유지
- [ ] RulesProfile/module/source compatibility negotiation
- [ ] validated session modules temporary mount
- [ ] unknown player-local rules DM review policy
- [ ] CombatEvent/choice/reaction/economy state sync
- [ ] reconnect/event dedupe/resync

### Phase 6 — Stability / Distribution

- [ ] schema/module/Character migration
- [ ] broken reference/cycle/invalid mechanic validation
- [ ] module dependency/conflict diagnostics
- [ ] Windows distribution
- [ ] 실제 LAN/Hamachi 다인 플레이 검증

## MVP 완료 조건

- [ ] 플레이어가 세션 없이 Character를 생성/수정/저장할 수 있다.
- [ ] default content module을 통해 일반적인 build 선택이 깨끗한 UX로 제공된다.
- [ ] deterministic feature는 자동 부여되고 실제 선택만 사용자에게 질문한다.
- [ ] required ChoiceDefinition이 해결되지 않으면 Final Review가 정확한 위치를 알려준다.
- [ ] 단일 homebrew feat JSON을 로컬 catalog에 import하고 default feat와 동일하게 사용할 수 있다.
- [ ] 모든 주요 계산값은 RuleSource/provenance로 설명 가능하다.
- [ ] feat/spell/item/condition의 실질 mechanics가 Predicate/Timing 포함 구조화 데이터로 관리된다.
- [ ] 시스템이 action economy/resource/action legality를 추적하고 설명한다.
- [ ] DM이 Combatant JSON과 session RuleModule을 검증/활성화할 수 있다.
- [ ] session module은 player local library를 자동 변경하지 않는다.
- [ ] 플레이어와 DM의 RulesProfile/module/source 호환 여부를 세션 시작 전에 판단할 수 있다.
- [ ] 공격/세이브/typed damage/critical/resistance/temp HP의 핵심 계산을 수동 산수 없이 처리한다.
- [ ] 주사위, calculation breakdown, state changes가 동일 CombatEvent를 사용한다.
- [ ] 안전한 범위에서 Undo가 HP/resource/economy를 일관되게 복구한다.
- [ ] 같은 Wi-Fi/Hamachi 세션에서 결과가 일관되게 동기화된다.

## MVP 이후 후보

- LAN session 자동 발견
- 최근 DM 주소 기억
- GM PIN/session access control
- 더 많은 dice syntax와 RuleSource mechanic primitive
- module export/bundle authoring UX
- module migration assistant
- 선택적 session log export/import
- Character/Combatant backup/recovery 개선
- 외부 AI를 이용한 RuleSource/RuleModule authoring 보조

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
