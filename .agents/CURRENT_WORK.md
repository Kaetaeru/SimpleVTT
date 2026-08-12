# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] `.agents/` 작업 공간을 프로젝트/공식 문서와 분리
- [x] 제품 목표를 전투 산수/규칙 상태 자동화 중심으로 확정
- [x] Character 생성/편집/레벨업 UX 방향 확정
- [x] RuleSource provenance / Predicate / Timing / action economy 방향 확정
- [x] RuleModule / ContentCatalog / ChoiceDefinition 방향 확정
- [x] Freeform / Initiative 공통 rules engine 방향 확정
- [x] Inventory / ItemDefinition / ItemInstance / magic-item 방향 확정
- [x] DM situational ruling/correction UX 방향 확정
- [x] authority / state lifetime / session write-back 방향 확정
- [x] ResolutionEvent / typed atomic StateChange 방향 확정
- [x] change-friendly extension seams / golden scenario 전략 확정
- [ ] 최신 설계 통합 PR을 `main`에 병합하고 이전 stacked design PR 정리
- [ ] 초기 D&D RulesProfile 선택/최소 규격 확정
- [ ] Combatant schema/template/example 실제 자동 validation 추가
- [ ] 첫 오프라인 vertical slice 구현 시작

## 제품 핵심 원칙

- 수학은 자동화하고 실제 선택은 플레이어/DM에게 남긴다.
- 모든 중요한 계산값은 RuleSource별 provenance로 설명할 수 있어야 한다.
- feat/spell/item/condition/class feature는 runtime prose parsing이 아니라 구조화 mechanics를 제공한다.
- 기본 콘텐츠와 homebrew JSON은 동일한 validation/rules pipeline을 사용한다.
- deterministic grant는 자동 적용하고 실제 선택만 ChoiceDefinition으로 질문한다.
- Character 원본은 player-local이다.
- connected session의 shared runtime event ordering/result는 DM host authoritative다.
- Character-owned durable runtime 변화는 authoritative ResolutionEvent 후 local write-back한다.
- Freeform과 Initiative는 같은 RuleSource/Predicate/Timing/ResolutionEvent 시스템을 사용한다.
- CombatEvent 용어는 폐기하고 ResolutionEvent를 공통 event/transaction 단위로 사용한다.
- imported content는 declarative only이며 unsupported mechanic은 명시적으로 드러낸다.
- UI는 rules의 source of truth가 아니다.
- 실제 플레이에서 실패한 scenario를 근거로 최소 primitive를 확장한다.

## 단기 체크리스트

### 1. 최신 설계 통합 / 저장소 정리 — 현재 작업

- [x] `docs/design/README.md` canonical design index 작성
- [x] `docs/rules/README.md` Common Rule Definition Specification `0.1-draft` 작성
- [x] Character lifecycle/create/edit/progression 계약 통합
- [x] RuleModule/ContentCatalog/Inventory/Item 계약 통합
- [x] authority/state lifetime/Freeform/Initiative/ResolutionEvent/DM ruling 계약 통합
- [x] combat/activity/dice/log UX 계약 통합
- [x] extensibility/versioning/golden scenario 계약 통합
- [x] Combatant import guide/schema/template/example 최신화
- [ ] 통합 PR diff 검증
- [ ] 통합 PR `main` squash merge
- [ ] superseded Draft PR #4/#6/#10/#12/#15/#16/#22 종료
- [ ] 통합본으로 충족된 design Issue #3/#5/#7/#11/#13/#14/#18/#19/#20/#21/#23 종료
- [ ] planning epic #17은 RulesProfile/implementation gate가 남아 있으므로 유지

### 2. 초기 RulesProfile — 다음 설계/구현 전 마지막 gate

- [ ] 초기 지원 D&D 규칙 버전/profile ID/version 확정
- [ ] stable Property registry 최소 집합
- [ ] derived formulas / stacking / rounding 규칙
- [ ] Predicate operator / TimingPoint / Duration 최소 registry
- [ ] action-economy buckets / reset / Freeform economy policy
- [ ] Initiative lifecycle ordering
- [ ] damage/resistance/immunity/vulnerability/critical policy
- [ ] ProgressionTrack / threshold semantics
- [ ] rest/recovery/time-advance policy
- [ ] initial content categories / validation tags
- [ ] required capabilities 목록
- [ ] 최소 default content module과 연결

### 3. Schema / scenario validation 기반

- [ ] `schemas/combatant.schema.json` 자체 JSON Schema 유효성 test
- [ ] template/example schema validation test
- [ ] semantic validator skeleton: IDs/references/property/timing/mechanic/capability
- [ ] Common Rule Specification schema tree 시작
- [ ] golden scenario fixture format 확정
- [ ] 초기 scenario 작성: AC provenance
- [ ] 초기 scenario 작성: attack + typed damage + resistance + temp HP
- [ ] 초기 scenario 작성: reaction changes AC
- [ ] 초기 scenario 작성: item charge + effect atomic transaction
- [ ] 초기 scenario 작성: Freeform -> Initiative state preservation
- [ ] 초기 scenario 작성: duplicate ResolutionEvent idempotency
- [ ] 초기 scenario 작성: DM force outcome + correction

### 4. 첫 Offline Vertical Slice

네트워크 없이 한 PC에서 end-to-end rules/domain/UX 흐름을 먼저 완성한다.

- [ ] Tauri + React + TypeScript scaffold
- [ ] rules/domain package와 React UI 경계 분리
- [ ] lint/typecheck/test/build + GitHub Actions
- [ ] local Character library / safe JSON persistence
- [ ] Guided/Quick Character draft 최소 UX
- [ ] default ContentCatalog에서 build 선택
- [ ] deterministic grant + ChoiceDefinition 처리
- [ ] local single RuleSource/feat JSON import
- [ ] ItemInstance 장착 -> AC provenance 재계산
- [ ] Combatant JSON import/review/instantiate
- [ ] Freeform check/Action Resolution
- [ ] Initiative start/end
- [ ] target selection + attack Resolution
- [ ] action economy/resource/item charge tracking
- [ ] authoritative dice record + visual presentation
- [ ] compact + expandable ResolutionEvent log
- [ ] safe Undo/correction

### 5. Vertical Slice 이후 실제 플레이 피드백

- [ ] 불편/미지원 규칙은 재현 가능한 golden scenario로 먼저 기록
- [ ] 기존 primitive로 표현 가능한지 확인
- [ ] 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting primitive 추가
- [ ] persisted contract 변경 시 version/migration/capability 갱신
- [ ] 기존 scenarios 회귀 검증
- [ ] UX는 domain schema와 분리해서 빠르게 수정

## 중기 이후

### LAN / Hamachi Session

- DM PC session host
- Character source는 player-local 유지
- RulesProfile/module/capability compatibility negotiation
- SessionProjection + snapshot/event cursor
- ActionRequest / Choice / ResolutionEvent sync
- session RuleModule temporary mount
- reconnect / duplicate / out-of-order handling
- durable Character write-back

### Stability / Distribution

- Character/Combatant/RuleModule migration
- invalid/unsupported content diagnostics
- save/recovery UX
- Windows distribution
- 실제 DM 1명 + player 2명 이상 LAN/Hamachi playtest

## MVP에서 의도적으로 제외

- cloud account/central Character server
- friend/social system
- chat/voice
- battle map/token/fog of war
- campaign wiki
- marketplace/package registry
- automatic Internet module download
- arbitrary executable rule/plugin scripts
- 앱 내부 AI runtime 의존
- 대규모 proprietary rules database 번들
- Foundry/Roll20 전체 대체
