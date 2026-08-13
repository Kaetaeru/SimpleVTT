# Character Creation UX — Canonical v0.9

Status: **canonical for Character creation UI/UX**

This document supersedes the v0.8 Character-creation step structure wherever the two conflict. The broader application, session, resolution, inventory, provenance, and progression principles remain unchanged.

## 1. Decision

The v0.8 concept below is removed:

```text
Core build
├── class
├── species
└── background
```

There is no `핵심 빌드` section in the canonical creation flow.

Class, species, and background are independent first-class sections. The player selects and inspects them separately, can revisit them before commit, and sees downstream choices update when an upstream source changes.

The default new Character begins at the RulesProfile's normal starting progression state. For the initial SRD-oriented profile, this is a level-1 Character. Choices that unlock later are not asked early merely to pre-plan a future build.

A subclass, later feat, later spell choice, Ability Score Improvement, or other progression-gated choice appears only when the relevant ProgressionDraft reaches the RuleSource-defined unlock point.

## 2. Baldur's Gate 3 as a UX reference

Baldur's Gate 3 is a **UX-structure reference, not a rules source**.

Useful structural ideas to adopt:

- major Character-defining decisions are separate selection domains rather than one combined form;
- species/race, variant/subrace when applicable, class, background, abilities, and skill choices are inspectable as distinct decisions;
- selecting one domain can change the legal or recommended options in another domain;
- class-driven spell, cantrip, or skill choices appear because the selected class requires them;
- the player can revisit earlier decisions before finalizing;
- a persistent Character summary shows the current build while navigating categories;
- option cards explain meaningful consequences before selection.

SimpleVTT deliberately does **not** copy:

- BG3-specific D&D rule changes;
- Origin Character rules;
- BG3's exact subclass timing;
- BG3's exact ability-score system;
- 3D avatar customization;
- BG3's visual art direction or cinematic presentation;
- hard-coded race/class/background lists.

SimpleVTT generalizes the useful structure through RulesProfile, ContentCatalog, RuleSource, ChoiceDefinition, AutomaticGrant, and ProgressionDraft contracts.

## 3. Mental model

Character creation operates over one autosaved draft.

```text
CharacterCreationDraft
        +
RulesProfile
        +
ContentCatalog
        +
current RuleSource selections
        ↓
CharacterCreationPlan
        ↓
independent sections
+ unresolved choices
+ automatic grants
+ derived preview
+ validation
```

Visible user principle:

> **캐릭터를 이루는 큰 선택을 하나씩 고르고, 그 선택 때문에 새로 생긴 질문만 답한다.**

## 4. Navigation

The builder uses a persistent section navigator rather than a permanently locked wizard.

Example:

```text
┌─────────────────┬───────────────────────────────┬─────────────────┐
│ 캐릭터 생성     │                               │ 현재 캐릭터     │
│                 │                               │                 │
│ ✓ 정체성        │        현재 선택 화면         │ 이름            │
│ ● 종족          │                               │ 인간            │
│ ○ 배경          │  option cards / detail       │ 병사            │
│ ○ 클래스        │                               │ 전사            │
│ ○ 능력치        │  grants / choices            │                 │
│ ○ 숙련          │  validation / provenance     │ STR 15          │
│ ○ 클래스 선택   │                               │ DEX 14          │
│ ○ 장비          │                               │ ...             │
│ — 주문          │                               │                 │
│ ○ 검토          │                               │ Blocking 1      │
└─────────────────┴───────────────────────────────┴─────────────────┘
```

A recommended order exists, but completed or available sections remain revisitable.

A section is blocked only when a real upstream dependency prevents resolution.

Example:

```text
클래스 선택 전
클래스 초기 선택: 대기 중

전사 선택 후
클래스 초기 선택: 전투 방식 1개 선택 필요
```

## 5. CharacterCreationPlan contract

React must not own a fixed array such as:

```ts
const CREATE_STEPS = [...]
```

The application layer provides a plan derived from the current draft.

Conceptual contract:

```ts
interface CharacterCreationPlan {
  draftId: string;
  rulesProfileId: string;
  recommendedSectionId: string;
  sections: CharacterCreationSection[];
  summary: CharacterCreationSummary;
  validation: ValidationMessage[];
}

interface CharacterCreationSection {
  id: string;
  kind:
    | "rules-profile"
    | "identity"
    | "species"
    | "background"
    | "class"
    | "abilities"
    | "proficiencies"
    | "class-choices"
    | "equipment"
    | "spells"
    | "dynamic-choice"
    | "review";
  label: string;
  status: "complete" | "incomplete" | "blocked" | "warning" | "not-applicable";
  required: boolean;
  dependsOn: string[];
  optionRefs?: string[];
  choiceDefinitionIds?: string[];
  automaticGrantRefs?: string[];
  validation: ValidationMessage[];
}
```

Exact TypeScript names are not frozen in UI Session 01. The architectural rule is frozen:

> **The active RulesProfile/content graph determines the plan; React renders the plan.**

## 6. Default section composition

The initial SRD-oriented shape is:

```text
규칙
정체성
종족
배경
클래스
능력치
숙련 · 언어 · 도구
클래스 초기 선택
장비
주문 · 기타 선택      ← only when required
검토
완료
```

This is a default composition, not a universal hard-coded list.

## 7. RulesProfile

The Character always stores RulesProfile identity/version.

If only one valid profile is installed and active, the UI may preselect it and keep this section visually quiet. If several profiles are available, the player explicitly chooses one.

Changing RulesProfile is a high-impact source change and must show which existing selections become invalid, unsupported, or unresolved.

## 8. Identity

Identity contains non-build presentation data such as Character name, portrait/avatar reference, and appearance/personality/player notes.

Identity is not mixed with mechanical class/species/background selection.

## 9. Species

Species is an independent ContentCatalog selection surface.

Compact option card:

```text
인간
이동 30 ft
주요 특성 3
SRD 5.2.1
```

Detail may show size, speed, senses, AutomaticGrants, unresolved species ChoiceDefinitions, source/module/version, and compatibility state.

If a species creates a variant/lineage/subspecies choice, the child choice appears because the selected RuleSource requires it.

React must not implement name-based rules such as `if species === "Elf"`.

## 10. Background

Background is an independent ContentCatalog selection surface.

It displays its own grants and choices, for example skill proficiencies, tools/languages when supported, origin feat or other profile-defined grant, equipment/resource choices, and source metadata.

Background is never a secondary field inside Class.

## 11. Class

Class is an independent ContentCatalog selection surface.

A class option should expose enough information for the current starting-level decision, such as Hit Die, recommended abilities, save/proficiency grants, armor/weapon permissions, current-level AutomaticGrants, current-level ChoiceDefinitions, spellcasting presence, and source/module/version.

The Class section selects **the class source itself**.

Choices caused by the class are rendered in generated sections such as `클래스 초기 선택`, `숙련`, or `주문`.

## 12. Future progression choices are not preselected

The creator asks only for choices active at the current creation progression state.

Example:

```text
new Character
→ Fighter 1
→ no subclass question if subclass unlock is later

later
Fighter 2 → 3 ProgressionDraft
→ subclass ChoiceDefinition becomes active
→ player chooses subclass
→ review
→ commit Character revision
```

The same rule applies to later feats, ASI choices, later spells, later class features, and progression-gated module choices.

Character creation is not a future-build planner.

## 13. Creating above the normal starting level

If SimpleVTT later supports direct creation at level N, it should not expose every future choice inside the Class screen.

Preferred semantics:

```text
create valid starting Character source
→ ProgressionDraft to next threshold
→ resolve unlocked choices
→ review/commit
→ repeat until requested starting level
```

The UI may present this as one setup experience, but creation and progression keep the same domain semantics.

## 14. Abilities

Ability generation remains an independent section.

The initial SRD-oriented profile can expose Standard Array, profile-defined random generation, Point Buy, and explicit Custom/manual input for migration/homebrew/override cases.

Class may provide recommendations:

```text
전사 추천
★ 근력
★ 건강
[추천 배치 적용]
```

Recommendations are not silently committed and are not rule constraints unless RulesProfile says otherwise.

## 15. Proficiencies, languages, and tools

This section separates deterministic grants from actual choices.

```text
자동 부여
✓ 근력 내성
✓ 건강 내성
✓ 모든 방어구

선택 필요
기술 숙련 2개
□ 운동
□ 곡예
□ 지각
...
```

Candidate sets and selection counts come from resolved RuleSources and ChoiceDefinitions contributed by class, species, background, and modules.

React does not own a class-specific static skill list.

## 16. Initial class choices

This section contains unresolved class choices active at the current creation level.

Examples may include Fighting Style, current-level mastery/weapon choices, or other class-specific ChoiceDefinitions.

Automatic class grants are shown for context but are not presented as fake choices.

## 17. Equipment

Starting equipment/loadout is an independent section when the active profile/content requires it.

Selected equipment can preview resulting ItemInstances, initial equip/wield state, Actions/Reactions granted by items, derived AC or other affected properties, quantities/charges, and provenance.

## 18. Spells and other conditional sections

Spell choice is not a permanently visible mandatory step for every Character.

If the current source graph produces spell/cantrip/preparation ChoiceDefinitions, the plan adds or activates a relevant section. If no such choice exists, the section is `not-applicable` or omitted by presentation policy.

The same mechanism supports module-defined choice domains without adding name-specific React code.

## 19. Choice presentation

Each section distinguishes:

```text
selected source
automatic consequences
unresolved choices
```

Option cards show Korean display name, short meaning/role, major grants, and source badge. Detail/hover may expose requirements, complete relevant grants, downstream choices, affected derived properties, English original name, module/version, and provenance.

## 20. Persistent Character summary

A creation summary stays visible where practical at desktop sizes.

It emphasizes current source decisions and unresolved work:

```text
이름        Aelar
종족        인간
배경        병사
클래스      전사 1

능력치
STR 15 ...

미완료
숙련 1
클래스 선택 1

Blocking 0
Warning 1
```

The summary is a projection of the draft, not a second editable source form.

## 21. Guided and Quick Create

Guided and Quick use the same CharacterCreationDraft and CharacterCreationPlan.

Guided:

- focuses one section at a time;
- provides recommendations and explanations;
- navigates toward the next useful incomplete section;
- keeps the section rail available for revisiting earlier decisions.

Quick:

- exposes a denser multi-section editor for experienced users;
- does not bypass validation or ChoiceDefinitions;
- does not use a separate simplified Character model;
- can jump among sections and apply recommendation presets.

Switching Guided ↔ Quick never recreates or discards the draft.

## 22. Import and Duplicate

Import and Duplicate initialize the same draft/source graph and then use the same CharacterCreationPlan to expose unresolved choices, missing modules, unsupported mechanics, invalid references, and required review.

Import is not a bypass around semantic review.

## 23. Validation and section status

Section status is derived from plan state:

- `complete` — all required inputs resolved;
- `incomplete` — user input remains;
- `blocked` — a genuine upstream dependency prevents resolution;
- `warning` — valid but unusual or worth review;
- `not-applicable` — the current source graph has no relevant choice.

Blocking validation links directly to the responsible section/ChoiceDefinition.

## 24. Dependency changes

Changing a major source recalculates the plan immediately.

Example:

```text
Class: Fighter → Wizard

removed
- Fighter saving throws
- Fighting Style choice
- martial starting-equipment choice

added
- Wizard proficiencies
- cantrip choices
- spell choices
- spellbook/equipment choices

needs review
- ability recommendation changed
- one selected skill is no longer legal
```

The UI shows meaningful consequences instead of silently resetting unrelated source data.

## 25. Final review

Review separates source decisions from derived consequences.

Required groups:

```text
Source choices
- RulesProfile
- identity
- species
- background
- class
- abilities/source values
- ChoiceDefinition selections
- equipment/loadout

Automatic grants
- features
- proficiencies
- resources
- Actions/Reactions

Derived
- HP
- AC
- movement
- saves/skills
- attack/spell properties

Validation
- Blocking
- Warning
- Unsupported

Provenance
- content/module/version references
- explicit overrides
```

Only after review/validation does the draft commit a Character source revision.

## 26. Relationship to level-up

Character creation and level-up share one rule:

> **Deterministic grants are automatic; only choices currently unlocked by the source graph are presented.**

Creation resolves the starting source graph. Level-up resolves a ProgressionDraft.

Subclass, feat, and similar future decisions are therefore not permanent Character-creator tabs. They appear when their ChoiceDefinition becomes active.

## 27. BG3 ideas translated into SimpleVTT

```text
BG3-style separate race/background/class categories
→ separate plan sections backed by ContentCatalog

option cards with visible consequences
→ RuleSource summary + AutomaticGrant/ChoiceDefinition preview

class changes skill/spell choices
→ recompute CharacterCreationPlan from the source graph

revisit categories before confirmation
→ persistent section rail over one autosaved draft

conditional spells/cantrips
→ dynamic sections generated from active ChoiceDefinitions

persistent character preview
→ CharacterCreationSummary projection
```

The transfer is architectural, not cosmetic.

## 28. UI Session 01 implementation consequences

The current prototype must be revised before Character-creation walkthrough acceptance:

1. remove `핵심 빌드`;
2. split species, background, and class into independent section surfaces;
3. replace the fixed React step array with an application-provided CharacterCreationPlan/ViewModel;
4. keep Guided navigation revisitable rather than strictly linear;
5. move subclass and other future progression choices out of default level-1 creation;
6. add current-level class ChoiceDefinitions dynamically;
7. make spell/other sections conditional;
8. preserve existing ability-generation methods as an independent section;
9. show source selections and unresolved choices in the persistent summary;
10. preserve autosave, provenance, validation, Quick, Import, and Duplicate over the same draft.

## 29. Acceptance walkthrough

Character creation is not accepted until the owner can complete this flow without code/data edits:

```text
새 캐릭터
→ 이름 입력
→ 종족 화면에서 선택 및 상세 확인
→ 배경 화면에서 별도 선택
→ 클래스 화면에서 별도 선택
→ 능력치 방법 선택 및 배치
→ 자동 숙련 확인 + 실제 선택만 처리
→ 현재 레벨 클래스 Choice 처리
→ 시작 장비 선택
→ 필요한 캐릭터에서만 주문/추가 Choice 처리
→ 이전 섹션을 자유롭게 오가며 선택 변경
→ 변경에 따른 후속 Choice/derived preview 갱신 확인
→ 검토
→ Character revision 생성
```

A level-1 class whose subclass unlocks later must complete this walkthrough **without asking for the subclass**.

The subclass is validated separately through the level-up walkthrough at its actual progression threshold.
