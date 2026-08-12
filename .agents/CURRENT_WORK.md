# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] 제품/아키텍처 canonical 설계 통합
- [x] Common Rule Definition Specification `0.1-draft`
- [x] Character 생성/편집/레벨업 계약
- [x] RuleSource / provenance / Predicate / Timing / action economy 계약
- [x] RuleModule / ContentCatalog / ChoiceDefinition 계약
- [x] cross-module `parent` / `extends` / `replaces` / Choice option / Progression contribution 계약 (Issue #26 / PR #31)
- [x] Inventory / ItemDefinition / ItemInstance / magic-item 계약
- [x] Freeform / Initiative / authority / state lifetime / write-back 계약
- [x] Targeting / EffectInstance / ResolutionEvent / StateChange 계약
- [x] DM situational ruling/correction UX 계약
- [x] extensibility/versioning/golden-scenario 전략
- [x] Combatant import guide/schema/template/example `0.2-draft`
- [x] 초기 RulesProfile: **D&D SRD 5.2.1 / CC-BY-4.0**
- [x] RulesProfile identity: `dnd.srd-5.2.1` / `0.1-draft`
- [x] 한국어-first localization: `ko-KR`, 기준 `Kaetaeru/D-D-2024-`
- [x] Issue #32 / PR #33 RulesProfile + localization 설계 병합
- [ ] Issue #34 / Draft PR #35 executable rules contracts review/merge
- [x] PR #35 Contract validation CI 전체 checkout 통과
- [ ] semantic validator + 추가 golden scenarios
- [ ] 대표 한국어 SRD content bootstrap
- [ ] TypeScript rules/domain + 첫 offline vertical slice 시작

## 제품 핵심 원칙

- 수학은 자동화하고 실제 선택은 플레이어/DM에게 남긴다.
- 모든 중요한 계산값은 RuleSource별 provenance로 설명 가능해야 한다.
- 이름 있는 class/subclass/species/feat/spell/item/condition은 prose parsing이나 resolver hard-code가 아니라 구조화 content로 제공한다.
- RulesProfile은 규칙 의미를 정의하고 Default RuleModule은 이름 있는 SRD 콘텐츠를 제공한다.
- builtin과 homebrew는 동일한 RuleModule/ContentCatalog/validation pipeline을 사용한다.
- cross-module 의미는 stable ID 기반 `parent` / additive `extends` / explicit `replaces`로 결정하고 load order로 결정하지 않는다.
- Character 원본은 player-local, connected shared runtime 결과는 DM host authoritative다.
- Freeform과 Initiative는 같은 RuleSource/Predicate/Timing/ResolutionEvent 시스템을 사용한다.
- imported content는 declarative only이며 unsupported mechanic은 명시적으로 드러낸다.
- UI와 localized prose는 rules의 source of truth가 아니다.
- persisted 규칙 확장은 실제 실패 scenario를 근거로 최소 primitive만 추가한다.
- SRD 5.2.1 파생 번들은 CC-BY-4.0 attribution과 non-SRD proprietary boundary를 지킨다.
- 기본 rules-content locale은 `ko-KR`; 한국어명/설명은 `Kaetaeru/D-D-2024-`의 검수된 SRD 번역/용어집/번역 지침을 우선한다.
- 번역 변경은 stable content ID나 mechanical compatibility를 바꾸지 않는다.

## 단기 체크리스트

### 1. Executable Rules Contracts — Issue #34 / PR #35

현재 브랜치: `agent/34-executable-rules-contracts`

```text
profileId: dnd.srd-5.2.1
profileVersion: 0.1-draft
defaultModuleId: dnd.srd-5.2.1.core
defaultContentLocale: ko-KR
```

- [x] machine-readable Property registry
- [x] ability modifier Expression AST
- [x] Proficiency Bonus thresholds/multipliers
- [x] D20 Test / Advantage-Disadvantage registry
- [x] Predicate operator registry
- [x] TimingPoint registry
- [x] explicit Initiative policy
- [x] explicit AC formula-candidate policy
- [x] Initiative economy / Freeform economy policy
- [x] typed damage / critical / Resistance / Vulnerability / Immunity policy
- [x] Temporary HP policy
- [x] progression/rest/activation/category/capability metadata
- [x] `schemas/rules-profile.schema.json`
- [x] `schemas/rule-module.schema.json`
- [x] `schemas/content-entry.schema.json`
- [x] `schemas/localized-presentation.schema.json`
- [x] `schemas/golden-scenario.schema.json`
- [x] Default SRD RuleModule manifest skeleton
- [x] `ko-KR` / translation-source / `srd-only` distribution metadata
- [x] ability-modifier golden fixture
- [x] Advantage + Disadvantage cancellation fixture
- [x] homebrew subclass `parent` + `extends` + Progression contribution fixture
- [x] repeatable `tools/validate_contracts.py`
- [x] 기존 Combatant schema/example/template도 validator에 연결
- [x] minimal GitHub Actions `Contract validation`
- [x] full PR checkout CI success
- [ ] PR #35 review/merge

### 2. Semantic validation + Golden Scenarios — 다음 작업

Structural JSON Schema 다음 계층이다.

- [ ] stable ID uniqueness / qualified reference resolution
- [ ] RulesProfile property/operator/TimingPoint registry membership
- [ ] module dependency/version/capability checks
- [ ] `parent` / `extends` / `replaces` target resolution
- [ ] missing parent / relationship cycle / competing replacement diagnostics
- [ ] extension-point category compatibility
- [ ] ProgressionContribution target/threshold validation
- [ ] localized presentation quality gate for builtin SRD content
- [ ] non-SRD translated prose leakage check strategy
- [ ] AC formula candidate + item/effect scenario
- [ ] Initiative + surprise + economy/reset scenario
- [ ] attack hit/miss + critical scenario
- [ ] multi-target save + shared damage roll scenario
- [ ] typed damage + R/V/I + temp HP scenario
- [ ] Reaction interrupt scenario
- [ ] Short/Long Rest recovery scenario
- [ ] ItemInstance charge + effect atomic transaction scenario
- [ ] Freeform -> Initiative -> Freeform preservation scenario
- [ ] DM force outcome + correction scenario
- [ ] external Choice option contribution scenario
- [ ] subclass Progression contribution scenario
- [ ] duplicate ResolutionEvent idempotency scenario
- [ ] translation-only revision preserves mechanical result scenario
- [ ] Korean name + English original name search-equivalence scenario

### 3. Default SRD Content Bootstrap

전체 SRD를 먼저 옮기지 않는다. 위 golden scenarios와 첫 vertical slice에서 실제로 쓰는 항목만 추가한다.

- [ ] representative class + subclass
- [ ] representative species + background
- [ ] representative feat / extensible option ChoiceDefinition
- [ ] basic weapon/armor subset
- [ ] charge-based magic item 1개 이상
- [ ] Reaction source 1개 이상
- [ ] representative spells for attack/save/effect paths
- [ ] representative Combatants
- [ ] 필요한 conditions/effects subset
- [ ] reviewed Korean `name` / `description` from `Kaetaeru/D-D-2024-/10-RULEBOOKS/srd-5.2.1/`
- [ ] English `originalName`, SRD source, translation provenance
- [ ] final repository/product SRD attribution notice location

### 4. 첫 Offline Vertical Slice

- [ ] Tauri + React + TypeScript scaffold
- [ ] React와 독립된 rules/domain package
- [ ] lint/typecheck/test/build CI
- [ ] local Character library / safe JSON persistence
- [ ] Guided/Quick Character draft 최소 UX
- [ ] `ko-KR` rules-content 기본 표시 + English original-name search
- [ ] default ContentCatalog + local module merge
- [ ] deterministic grants + ChoiceDefinition
- [ ] external subclass/species/choice contribution path
- [ ] local homebrew RuleSource/content JSON import
- [ ] ItemInstance activation -> property provenance
- [ ] Combatant import/review/instantiate
- [ ] Freeform Action Resolution
- [ ] Initiative start/end + economy
- [ ] target selection + attack/damage Resolution
- [ ] Resource/item charge tracking
- [ ] authoritative dice records
- [ ] compact + expandable ResolutionEvent log
- [ ] safe Undo/correction

## 이후 원칙

실제 플레이/구현에서 표현 불가능하거나 불편한 경우:

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. UX는 domain contract와 가능한 한 분리해서 빠르게 수정한다.

## 중기 이후

- LAN / Hamachi host session protocol
- RulesProfile/module/capability negotiation
- snapshot + ResolutionEvent cursor sync
- session RuleModule temporary mount
- reconnect / duplicate / out-of-order handling
- Character durable write-back
- schema/data migrations
- Windows distribution
- 실제 DM + 여러 player playtest

## MVP에서 의도적으로 제외

- cloud account / central Character server
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
