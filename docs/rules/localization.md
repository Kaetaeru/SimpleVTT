# Localization and Korean Content Presentation

Status: normative pre-implementation contract

This document defines how SimpleVTT separates executable rule mechanics from human-readable localized content, with Korean as the default presentation language for the initial SRD 5.2.1 experience.

## 1. Core principle

Rule mechanics and display prose are separate concerns.

A feat, spell, item, class feature, species feature, condition, Action, or other content entry is identified and executed through stable IDs and structured mechanics. The resolver never parses Korean or English prose to determine behavior.

Localized text exists for user understanding, search, authoring review, provenance display, and logs.

```text
ContentEntry / RuleSource
├─ stable identity
├─ structured mechanics
├─ source/license metadata
└─ localized presentation
   ├─ ko-KR
   └─ other locales / fallback
```

Changing a translation must not change the mechanical identity or rules outcome of the content.

## 2. Default locale

The initial SimpleVTT product locale for rules content is:

```text
defaultLocale: ko-KR
```

For the bundled `dnd.srd-5.2.1.core` RuleModule:

- every player-visible named content entry required by the supported slice must provide a Korean display name;
- every player-visible feat, spell, item, magic item, class/subclass feature, species/background feature, condition, Action/Reaction/Activity, and similar ability should provide Korean explanatory text when that text exists in the source content;
- Korean is used by default in Character creation, level-up, inventory, action cards, target/resolution prompts, tooltips, provenance summaries, and the activity log;
- an English original name may be available in detail/debug/search views, but it is not the default visible label.

A distributable built-in SRD entry that is missing required `ko-KR` text should fail the content-quality gate rather than silently shipping English-only UI.

## 3. Authoritative Korean reference repository

For SRD 5.2.1 Korean terminology and prose, SimpleVTT uses the owner's private reference repository:

```text
Kaetaeru/D-D-2024-
```

The relevant authority order for SimpleVTT's bundled SRD Korean content is:

1. `10-RULEBOOKS/srd-5.2.1/` — reviewed Korean translation of SRD 5.2.1 content;
2. `90-WORKBENCH/docs/glossary*.md` — standardized English-to-Korean rule terminology;
3. `90-WORKBENCH/docs/translation-guide.md` — translation accuracy and notation rules;
4. `90-WORKBENCH/docs/translation-decisions.md` — recurring style and editorial decisions;
5. official SRD 5.2.1 English source and current errata for semantic verification.

When the translation repository and an older SimpleVTT localization disagree, the reviewed SRD translation/glossary should be treated as the Korean wording source unless a newer explicit SimpleVTT correction records why it diverges.

## 4. License boundary

The translation reference repository deliberately separates SRD and non-SRD material.

SimpleVTT may bundle/reuse SRD 5.2.1-derived Korean text only under the same CC BY 4.0 attribution requirements that govern the SRD-derived translation.

The default distributable RuleModule must not copy PHB 2024, DMG 2024, MM 2025, setting, or other non-SRD proprietary translated prose merely because it exists in the owner's private translation repository.

Non-SRD private translations may still inform terminology consistency or be used by the owner in private/local modules where appropriate, but they are not part of the distributable `dnd.srd-5.2.1.core` dataset unless their redistribution rights are separately established.

## 5. Localized presentation contract

The exact JSON serialization will be finalized with the RuleModule schema, but every localizable content entry should conceptually support:

```ts
interface LocalizedPresentation {
  locale: string
  name: string
  shortName?: string
  summary?: string
  description?: string
  sections?: LocalizedSection[]
  keywords?: string[]
}

interface ContentPresentation {
  originalName?: string
  defaultLocale: string
  locales: Record<string, LocalizedPresentation>
  translationSource?: TranslationSourceRef
}
```

`description` and `sections` are presentation data only. Structured Mechanics, Predicates, Timing, Actions, Resources, and StateChanges remain the executable source of truth.

## 6. Korean writing rules

The bundled Korean SRD content follows the established translation repository conventions.

### Accuracy before elegance

- preserve rule procedure, conditions, exceptions, numbers, and timing;
- do not add house rules or interpretation to the translated ability text;
- preserve distinctions such as permission, requirement, and optional choice;
- preserve `if`, `when`, `before`, `after`, `until`, turn/round, rest, and similar timing relationships.

### Style

- use concise explanatory Korean rather than honorific prose;
- prefer `캐릭터`, `크리처`, or `대상` over mechanically translating every `you` as `당신`;
- do not shorten a rule if doing so changes trigger timing, eligibility, cost, target, or exception behavior;
- use the approved glossary consistently.

### Notation

Use established forms such as:

```text
d20
2d6 + 3
DC 15
AC 16
30피트
1레벨
```

The app may style these visually, but the stored Korean text should retain unambiguous rule notation.

## 7. Names and original-name metadata

Player-facing titles use the reviewed Korean name.

The original English source name remains metadata for:

- search;
- import matching;
- debugging;
- source comparison;
- translation maintenance;
- identifying content across external references.

Example:

```json
{
  "id": "feat.alert",
  "originalName": "Alert",
  "presentation": {
    "defaultLocale": "ko-KR",
    "locales": {
      "ko-KR": {
        "name": "경계"
      }
    }
  }
}
```

Stable IDs never depend on the translated display name.

## 8. Search and discovery

ContentCatalog search should index at least:

- Korean display name;
- English original name;
- Korean keywords/tags;
- profile-defined aliases where available.

Therefore a user may search either `경계` or `Alert` and reach the same feat entry while the normal UI remains Korean-first.

## 9. Descriptions and structured mechanics

Localized prose explains the content but does not execute it.

For example, a Korean feat description may say that an initiative roll receives a bonus, while the executable representation separately contains the corresponding typed Mechanic.

```text
Korean description
"우선권 굴림에 숙련 보너스를 더할 수 있다."

        != parsed by resolver

Structured mechanic
Property/Roll contribution -> initiative roll
```

Content review must verify that the Korean explanation and structured mechanics describe the same rule.

A mismatch is a content validation/review defect, not something the runtime resolves by parsing the text.

## 10. Translation provenance

SRD-derived localized content should preserve enough metadata to trace where the Korean wording came from.

Conceptual fields:

```text
sourceDocument: SRD 5.2.1
sourceCode: SRD52
sourceEntry: <stable source reference>
sourceLicense: CC-BY-4.0
translationRepository: Kaetaeru/D-D-2024-
translationPath: <path under 10-RULEBOOKS/srd-5.2.1/ or glossary>
translationRevision: <commit/blob/revision when practical>
translationStatus: reviewed | draft | source-only
errataChecked: <date when tracked>
```

The final schema may normalize these into module-level and entry-level metadata to avoid repetition.

## 11. Translation revision vs mechanic revision

Text-only localization changes should not invalidate a Character or change rule execution.

The implementation should distinguish, logically or explicitly:

- mechanic/content semantic revision;
- localization/translation revision.

If `경계` is reworded without changing its structured mechanics, old Characters that selected the feat remain compatible and the resolver produces the same outcome.

Persisted Character source stores stable module/content IDs, not a copied Korean description as its mechanical source of truth.

## 12. Activity log and provenance language

ResolutionEvents store stable IDs and structured provenance. UI rendering resolves localized names for the current presentation locale.

Default Korean display example:

```text
경계
우선권 굴림
12 + 숙련 보너스 3 = 15
```

A developer/detail view may additionally expose:

```text
feat.alert (Alert)
module: dnd.srd-5.2.1.core
```

The visible Korean label is not used as an event identity.

## 13. Homebrew and imported modules

Homebrew modules use the same localization model.

A user-authored module may be Korean-only:

```text
defaultLocale: ko-KR
locales: [ko-KR]
```

or may provide multiple languages.

For non-built-in content:

- `ko-KR` is preferred for the user's normal experience but not structurally mandatory for all third-party/imported modules;
- if the current UI locale is unavailable, use the module's declared default locale;
- if only an original/display name exists, show it with a clear fallback state rather than rejecting mechanically valid content;
- translation completeness is separate from mechanic capability compatibility.

## 14. Default SRD content import workflow

When converting translated SRD material into `dnd.srd-5.2.1.core` entries:

1. identify the exact SRD 5.2.1 source entry;
2. load the reviewed Korean wording from `Kaetaeru/D-D-2024-/10-RULEBOOKS/srd-5.2.1/`;
3. apply the repository glossary and translation decisions;
4. model the rule as structured Mechanics/Predicates/Timing/Choices/Actions;
5. compare structured behavior against the official English SRD source and current errata;
6. attach source/license/translation provenance;
7. run deterministic scenarios for mechanically meaningful behavior;
8. expose Korean presentation as the default UI text.

AI-assisted conversion may help draft structured data, but it does not bypass source comparison, validation, or human-readable review.

## 15. Initial quality gate

Before an SRD content entry is considered ready for the built-in module, verify:

- stable content ID;
- original English name;
- reviewed Korean name;
- reviewed Korean description/sections where applicable;
- structured mechanics represent the same rule;
- source and CC BY attribution metadata;
- no non-SRD proprietary text leaked into the distributable entry;
- required predicates/timing/resources/actions are supported;
- deterministic scenario coverage when the entry exercises important resolver behavior.

## 16. Initial examples from the Korean SRD corpus

The current reference repository already establishes Korean terminology such as:

```text
Alert -> 경계
Magic Initiate -> 마법 입문자
Savage Attacker -> 야만적 공격자
Ability Score Improvement -> 능력치 향상
Grappler -> 붙잡기 전문가
Archery -> 궁술
Defense -> 방어
Great Weapon Fighting -> 대형 무기 전투
Two-Weapon Fighting -> 쌍수 전투
```

SimpleVTT should reuse these reviewed names rather than independently inventing a second Korean terminology set.

## 17. Non-goals

This localization contract does not:

- make prose executable;
- grant permission to redistribute non-SRD proprietary translations;
- require every homebrew module to support English;
- require every future UI string to live inside RuleModule content;
- make translation-only edits break mechanical compatibility;
- replace the translation repository's glossary/review workflow.
