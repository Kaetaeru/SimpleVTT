# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] 최신 제품/아키텍처 설계를 canonical 문서 세트로 통합
- [x] Common Rule Definition Specification `0.1-draft` 병합
- [x] Character 생성/편집/레벨업 계약 병합
- [x] RuleSource / provenance / Predicate / Timing / action economy 계약 병합
- [x] RuleModule / ContentCatalog / ChoiceDefinition 계약 병합
- [x] cross-module `parent` / `extends` / `replaces` / Choice option / Progression contribution 계약 병합 (Issue #26 / PR #31)
- [x] Inventory / ItemDefinition / ItemInstance / magic-item 계약 병합
- [x] Freeform / Initiative / authority / state lifetime / write-back 계약 병합
- [x] Targeting / EffectInstance / ResolutionEvent / StateChange 계약 병합
- [x] DM situational ruling/correction UX 계약 병합
- [x] extensibility/versioning/golden-scenario 전략 병합
- [x] Combatant import guide/schema/template/example `0.2-draft` 병합
- [x] 초기 RulesProfile source 선택: **D&D SRD 5.2.1 / CC-BY-4.0**
- [x] 초기 profile identity 선택: `dnd.srd-5.2.1` / `0.1-draft`
- [ ] Issue #32 RulesProfile Draft PR review/merge
- [ ] RulesProfile registry/schema + golden-scenario fixture를 executable contract로 전환
- [ ] Combatant schema/template/example 자동 validation 추가
- [ ] 첫 오프라인 vertical slice 구현 시작

## 제품 핵심 원칙

- 수학은 자동화하고 실제 선택은 플레이어/DM에게 남긴다.
- 모든 중요한 계산값은 RuleSource별 provenance로 설명 가능해야 한다.
- 이름 있는 class/subclass/species/feat/spell/item/condition은 runtime prose parsing이나 resolver hard-code가 아니라 구조화 content로 제공한다.
- RulesProfile은 규칙 의미를 정의하고, Default RuleModule은 이름 있는 SRD 콘텐츠를 제공한다.
- 기본 콘텐츠와 homebrew JSON은 동일한 validation/rules pipeline을 사용한다.
- RuleModule은 standalone content와 기존 content에 대한 additive contribution을 모두 표현할 수 있어야 한다.
- cross-module 관계는 stable ID 기반 `parent` / `extends` / explicit `replaces`를 사용하고 load order로 의미를 결정하지 않는다.
- deterministic grant는 자동 적용하고 실제 선택만 ChoiceDefinition으로 질문한다.
- Character 원본은 player-local이다.
- connected session의 shared runtime ordering/result는 DM host authoritative다.
- Character-owned durable runtime 변화는 authoritative ResolutionEvent 후 local write-back한다.
- Freeform과 Initiative는 같은 RuleSource/Predicate/Timing/ResolutionEvent 시스템을 사용한다.
- imported content는 declarative only이며 unsupported mechanic은 명시적으로 드러낸다.
- UI는 rules의 source of truth가 아니다.
- 실제 플레이에서 실패한 scenario를 근거로 최소 primitive를 확장한다.
- SRD 5.2.1은 public domain이 아니라 CC-BY-4.0 licensed source이므로 배포 시 required attribution과 non-SRD proprietary boundary를 지킨다.

## 단기 체크리스트

### 1. Initial RulesProfile — 현재 작업

Source: `System Reference Document 5.2.1`

```text
profileId: dnd.srd-5.2.1
profileVersion: 0.1-draft
defaultModuleId: dnd.srd-5.2.1.core
sourceLicense: CC-BY-4.0
```

- [x] source/version/license boundary
- [x] RulesProfile vs Default RuleModule boundary
- [x] ability modifier / Proficiency Bonus baseline
- [x] D20 Test / Advantage-Disadvantage policy
- [x] Initiative / turn-round lifecycle baseline
- [x] Action / Bonus Action / Reaction / movement economy baseline
- [x] Freeform economy baseline
- [x] typed damage / critical / Resistance / Vulnerability / Immunity ordering
- [x] Temporary HP baseline
- [x] ProgressionTrack / multiclass-ready model
- [x] rest/recovery/time hooks
- [x] Item activation/attunement boundary
- [x] content category/extension-point boundary
- [x] first profile capability set
- [x] required golden-scenario list
- [ ] exact machine-readable Property registry
- [ ] exact machine-readable Predicate operator registry
- [ ] exact machine-readable TimingPoint registry
- [ ] exact machine-readable economy/damage/progression policy tables
- [ ] Default SRD RuleModule manifest/schema skeleton
- [ ] repository/product attribution notice location finalized before SRD-derived data ships

### 2. Schema / golden-scenario validation 기반

- [ ] `schemas/combatant.schema.json` 자체 JSON Schema 유효성 test
- [ ] template/example schema validation test
- [ ] Common Rule Specification 대응 JSON Schema tree
- [ ] RulesProfile schema/registry format
- [ ] RuleModule / ContentEntry schema
- [ ] `parent` / `extends` / `replaces` / extensionPoint / ProgressionContribution schema
- [ ] semantic validator skeleton: IDs/references/property/mechanic/Predicate/Timing/capability
- [ ] golden scenario fixture format
- [ ] ability/proficiency provenance scenario
- [ ] Advantage + Disadvantage cancellation scenario
- [ ] AC formula candidate + item/effect scenario
- [ ] Initiative + surprise + economy/reset scenario
- [ ] attack + critical scenario
- [ ] multi-target save + shared damage roll scenario
- [ ] typed damage + R/V/I + temp HP scenario
- [ ] Reaction interrupt scenario
- [ ] Short/Long Rest recovery scenario
- [ ] item charge + effect atomic transaction scenario
- [ ] Freeform -> Initiative -> Freeform preservation scenario
- [ ] DM force outcome + correction scenario
- [ ] homebrew subclass -> builtin class contribution scenario
- [ ] external Choice option contribution scenario
- [ ] subclass Progression contribution scenario
- [ ] missing parent / cycle / competing replacement validation scenarios
- [ ] duplicate ResolutionEvent idempotency scenario

### 3. Default SRD content bootstrap

전체 SRD를 먼저 변환하지 않는다. Vertical Slice와 golden scenarios에 필요한 대표 content부터 추가한다.

- [ ] Default RuleModule manifest `dnd.srd-5.2.1.core`
- [ ] 대표 class + subclass 관계
- [ ] 대표 species/background path
- [ ] 대표 feat/option ChoiceDefinition
- [ ] 기본 weapon/armor subset
- [ ] charge-based magic item 1개 이상
- [ ] Reaction source 1개 이상
- [ ] representative Combatant definitions
- [ ] 필요한 condition/effect subset
- [ ] source/license metadata preserved on module/content

### 4. 첫 Offline Vertical Slice

네트워크 없이 한 PC에서 end-to-end domain/UX를 먼저 완성한다.

- [ ] Tauri + React + TypeScript scaffold
- [ ] rules/domain package와 React UI 경계 분리
- [ ] lint/typecheck/test/build + GitHub Actions
- [ ] local Character library / safe JSON persistence
- [ ] Guided/Quick Character draft 최소 UX
- [ ] default ContentCatalog에서 build 선택
- [ ] builtin + local module ContentCatalog merge
- [ ] external subclass/species/choice-option contribution 최소 path
- [ ] deterministic grant + ChoiceDefinition
- [ ] local RuleSource/feat JSON import
- [ ] ItemInstance 장착 -> property provenance 재계산
- [ ] Combatant JSON import/review/instantiate
- [ ] Freeform check/Action Resolution
- [ ] Initiative start/end + action economy
- [ ] target selection + attack Resolution
- [ ] Resource/item charge tracking
- [ ] authoritative dice record + visual presentation
- [ ] compact + expandable ResolutionEvent log
- [ ] safe Undo/correction

### 5. Vertical Slice 이후 실제 플레이 피드백

- [ ] 불편/미지원 규칙을 deterministic failing scenario로 기록
- [ ] 기존 primitive로 표현 가능한지 먼저 확인
- [ ] 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content-relationship primitive 추가
- [ ] persisted contract 변경 시 version/migration/capability 갱신
- [ ] 기존 scenarios 회귀 검증
- [ ] UX는 domain schema와 분리해서 빠르게 수정

## 중기 이후

### LAN / Hamachi Session

- DM PC session host
- Character source player-local 유지
- RulesProfile/module/capability compatibility negotiation
- SessionProjection + snapshot/event cursor
- ActionRequest / Choice / ResolutionEvent sync
- session RuleModule temporary mount
- session content relationship/contribution compatibility validation
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
- non-SRD proprietary D&D content bundle
- Foundry/Roll20 전체 대체
