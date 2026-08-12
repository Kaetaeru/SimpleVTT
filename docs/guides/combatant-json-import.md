# Combatant JSON Authoring and Import

Combatant JSON lets a DM prepare reusable stat-block-like definitions without requiring a bundled monster database. The format is intentionally friendly to manual authoring and external AI-assisted conversion, but imported data is always declarative and locally validated.

## 1. Definition vs runtime state

A `CombatantDefinition` is reusable content.

A `CombatantState` is a mutable session/encounter instance created from a definition.

Import creates or updates a definition. It does not directly create authoritative HP damage, initiative, spent resources, or other live encounter mutations.

## 2. What a CombatantDefinition should contain

Include enough calculation-relevant information for the resolver to operate without manual arithmetic:

- stable ID and schema version;
- name and optional tags/metadata;
- ability/source values required by the selected RulesProfile;
- HP/AC/movement and other defenses;
- saves/skills when needed;
- resistances, immunities, vulnerabilities, condition immunities;
- Resources/charges;
- Actions/Reactions/Activities;
- passive RuleSources/mechanics;
- activation requirements;
- imported unsupported-mechanic notes when the current schema cannot represent something exactly.

Do not flatten everything to a single final attack bonus or AC if the source contributions are known and should remain explainable.

## 3. Import workflow

1. Select or paste Combatant JSON.
2. Parse JSON.
3. Validate against `schemas/combatant.schema.json`.
4. Run semantic validation against the active RulesProfile/Common Rule capabilities.
5. Show blocking errors, warnings, and unsupported mechanics.
6. Show a human-readable mechanical review.
7. Save to the DM's local Combatant library or instantiate into the current session.

No invalid definition becomes live authoritative state without review.

## 4. Structural validation

Schema validation checks shape and basic types, including:

- required IDs/name/version;
- numeric ranges where generally safe;
- action/resource/reference shapes;
- duplicate IDs within a definition where the application performs semantic validation;
- known top-level fields.

Structural validity does not guarantee that the active RulesProfile supports every mechanic.

## 5. Semantic validation

After schema validation, the application validates:

- RulesProfile compatibility;
- supported mechanic kinds;
- supported Predicate operators;
- supported TimingPoints;
- supported property paths;
- referenced Resource/Action/RuleSource IDs;
- activation references;
- damage/condition/tag identifiers known to the profile when required;
- target definitions;
- Effect/Duration capability;
- unresolved `unsupportedMechanics`.

Semantic validation errors should identify the exact path/source and provide a human-readable reason.

## 6. Review screen

Before activation, show a compact summary:

```text
Training Brute
HP 45      AC 15
Speed 30

Defenses
- Fire resistance

Resources
- Recharge Power: 1/1

Actions
- Heavy Strike
- Fire Burst

Passive rules
- Example resistance

Warnings / unsupported
- none
```

Each derived/mechanical section should be expandable to show RuleSource/Mechanic/Predicate/Timing details.

## 7. AI-assisted authoring

AI is an optional external authoring aid, not a runtime dependency.

Give the AI:

- the original stat block or homebrew description;
- `schemas/combatant.schema.json`;
- `templates/combatant.template.json`;
- `examples/combatant.example.json`;
- this guide;
- the active RulesProfile/common rule specification if detailed mechanics are required.

Recommended prompt pattern:

```text
Convert the supplied creature/stat block into a SimpleVTT CombatantDefinition JSON.

Requirements:
- Follow the supplied Combatant JSON Schema and template exactly.
- Represent calculation-relevant behavior declaratively.
- Use stable local IDs for actions/resources/rule sources.
- Do not invent executable code.
- Do not silently approximate a mechanic that the supplied schema/spec cannot express.
- Put any unrepresentable behavior in unsupportedMechanics with the original meaning and reason.
- Preserve damage types, defenses, action costs, recharge/resources, predicates, timing, and targeting when known.
- Output JSON only.
```

The produced JSON is still untrusted input and must pass local validation/review.

## 8. Unsupported mechanics

When a rule cannot be represented faithfully:

```json
{
  "unsupportedMechanics": [
    {
      "label": "Example special rule",
      "reason": "Current common rule primitives cannot represent this timing behavior.",
      "originalText": "Optional short source description or user-authored note."
    }
  ]
}
```

Unsupported content must never silently execute a partial approximation while claiming full support.

## 9. Actions and reactions

Actions use structured data for:

- kind/category;
- action-economy/resource/item costs;
- target strategy;
- roll/check/save plan;
- typed damage/healing;
- EffectInstance creation/removal;
- Predicates/Timing;
- mechanical notes and unsupported details.

The generic resolver must not contain branches for a Combatant's display name or Action name.

## 10. RuleSources

Passive/conditional features belong in `ruleSources`.

Examples:

- AC/defense contribution;
- resistance/immunity/vulnerability;
- roll modifier;
- action grant/restriction;
- triggered effect;
- resource/economy change;
- condition immunity;
- activation requirement.

RuleSources should retain stable local IDs so provenance/logs can point back to them.

## 11. Runtime instantiation

When a definition is added to a session, create a distinct CombatantState with:

- runtime instance ID;
- definition ID/version reference;
- current HP/temp HP;
- current Resources;
- activation state;
- active EffectInstances/conditions;
- initiative/economy state only when applicable.

Multiple runtime instances may share one definition.

## 12. Versioning and migration

The Combatant schema is versioned independently from the Common Rule Definition Specification and RulesProfile.

On load:

- validate schema version;
- migrate explicitly when supported;
- preserve the original file on migration/write failure;
- report incompatible future/unknown data safely;
- never silently discard unknown mechanics.

## 13. Security boundary

Combatant JSON is data only.

Forbidden:

- arbitrary JS;
- shell/native code;
- dynamic eval expressions;
- remote executable URLs;
- embedded plugin code.

Expressions and Predicates use only the restricted application-supported AST/registry.
