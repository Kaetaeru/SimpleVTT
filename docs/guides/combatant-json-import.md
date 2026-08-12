# Combatant JSON Import Guide

Status: Draft for Issue #3

This guide describes how a DM or external AI tool should author a SimpleVTT Combatant Definition for import.

The source of truth for machine validation is `schemas/combatant.schema.json`.

A starter file is available at `templates/combatant.template.json` and a complete fictional example is available at `examples/combatant.example.json`.

## Purpose

Combatant JSON should contain the calculation-relevant information needed to instantiate an encounter participant without requiring a bundled monster database.

The format is intended to support three authoring paths:

1. manual editing;
2. conversion from a stat block by a user-authored script/tool;
3. conversion by an external AI using the schema, template, and this guide.

AI is optional. SimpleVTT must never require an AI service to load or run Combatants.

## Import flow

1. Obtain or author the stat block/data you are allowed to use.
2. Convert it to the current SimpleVTT Combatant JSON version.
3. Import the file into SimpleVTT.
4. Validate against the JSON Schema.
5. Run semantic validation for rule-specific values and references.
6. Review a human-readable summary.
7. Save the definition locally and/or instantiate it in the encounter.

Imported data does not directly mutate an encounter until validation and review complete.

## Static definition vs encounter state

The JSON file describes a reusable **Combatant Definition**.

It should contain stable values such as:

- ability scores and modifiers;
- base AC;
- maximum HP;
- movement;
- final saving throw and skill bonuses supplied by the source;
- damage resistance/immunity/vulnerability information;
- condition immunities;
- reusable resources;
- traits and their machine-readable effects where applicable;
- actions and reactions.

The encounter creates separate mutable state such as:

- current HP;
- temporary HP;
- current resource counts;
- active temporary effects;
- conditions;
- turn/round state.

Do not use the reusable JSON definition as a live encounter save file.

## Ruleset field

`ruleset` identifies the rules profile used to interpret the data.

The initial supported D&D rules version has not yet been locked for this draft. Do not infer edition-specific formulas from the placeholder value in the example.

Once the first rules profile is selected, its identifier and semantic rules will be documented explicitly.

## IDs

Machine IDs use lowercase ASCII letters, numbers, `.`, `_`, and `-`.

Examples:

- `emberhide-brute`
- `heavy-club`
- `guard-ac`

IDs should be stable inside a definition because effects, resources, event logs, and migrations may refer to them.

Display names may use any user-facing language.

## Abilities and bonuses

Ability entries store both the score and modifier.

This is deliberate: imported Combatants should not depend on the UI silently deriving edition-specific values before the rules profile is known.

Saving throws and skills store final bonuses as written/converted from the source.

## Defenses and damage tags

Damage adjustments use declarative entries such as:

```json
{
  "mode": "resistance",
  "damageTypes": ["fire"]
}
```

Conditional adjustments may use `requiresTags` and `excludesTags`.

Example concept:

```json
{
  "mode": "resistance",
  "damageTypes": ["bludgeoning", "piercing", "slashing"],
  "excludesTags": ["magical"]
}
```

The resolver decides whether a damage component carries the matching tags.

Damage type and tag vocabularies will be normalized by the selected rules profile. Until then, use concise lowercase identifiers consistently.

## Resources

Resources are counters that actions/effects may spend or change.

Examples include:

- reaction availability;
- charges;
- limited-use abilities.

`initial` is the value used when encounter state is created. `max` is the reusable maximum.

## Actions

The draft supports four action kinds:

- `attack`
- `save`
- `healing`
- `utility`

### Attack

An imported stat block may provide a final `toHit` bonus directly.

Damage is stored as typed components so target-side defenses can apply independently.

Example:

```json
{
  "formula": "1d8+3",
  "type": "bludgeoning",
  "tags": ["weapon"]
}
```

### Save

A save action defines the ability, DC, successful-save damage behavior, and typed damage components.

The initial `onSuccess` values are `none`, `half`, `full`, and `custom`.

`custom` requires later semantic handling and should not be used when a standard result is sufficient.

### Healing

Healing stores a formula and does not use damage resistance rules.

### Utility

Utility actions cover structured effects that are neither a normal attack, save, nor healing roll.

## Effects

Effects are declarative modifier data. They are not JavaScript, Lua, shell code, or arbitrary executable expressions.

Each effect identifies:

- when it can apply (`timing`);
- who/what it affects (`scope`);
- the operation (`operation.kind`);
- the stable resolver target (`operation.target`);
- the operation payload (`operation.value` when needed);
- optional required/excluded tags;
- duration;
- human-readable source/description information.

Examples of intended operation targets include:

- `roll.attack`
- `roll.save.dex`
- `defense.ac`
- `damage.fire`
- `resource.reaction`

The exact supported target registry and semantic validation rules will be versioned with the resolver. A schema-valid unknown target must still be rejected or warned about by semantic validation if the active rules profile cannot interpret it.

## Validation levels

SimpleVTT should distinguish structural errors from semantic warnings/errors.

### Schema errors

Reject import when JSON structure is invalid, required fields are missing, types are wrong, or unknown top-level/core fields are present.

Example message:

`actions[1].save.dc: expected integer, received string`

### Semantic errors

Reject activation when the structure is valid but the current rules/resolver cannot safely execute it.

Examples:

- action references a resource ID that does not exist;
- unsupported effect operation target;
- impossible dice formula;
- duplicate action/effect/resource IDs.

### Warnings

Allow review with explicit warnings when data is usable but suspicious.

Examples:

- ability score/modifier pair does not match the selected rules profile;
- no actions are present;
- an optional source label is missing;
- a definition uses draft/extension data not used by the active resolver.

## Review screen requirements

Before activation, show at least:

- name and ruleset;
- base AC and max HP;
- ability values;
- saves;
- damage modifiers and condition immunities;
- resources;
- actions/reactions with attack bonuses, DCs, damage/healing formulas, and effects;
- validation warnings.

The user should be able to cancel without changing encounter state.

## AI-assisted conversion

When using an external AI, provide all of the following in the same context when possible:

- the source stat block;
- `schemas/combatant.schema.json`;
- `templates/combatant.template.json`;
- this guide;
- the active rules profile identifier and any rules-profile authoring notes.

A useful prompt pattern is:

```text
Convert the following stat block into a SimpleVTT Combatant Definition.

Requirements:
- Return JSON only. Do not wrap it in Markdown.
- Conform to schemaVersion "0.1-draft" and the attached JSON Schema.
- Preserve the source values; do not invent missing numerical rules data.
- Use stable lowercase ASCII IDs.
- Represent damage as separate typed components.
- Represent calculation-changing traits as declarative effects when the schema can express them.
- If a trait cannot be represented safely, preserve its text in description/notes instead of inventing executable behavior.
- Do not emit scripts, code, or new schema fields.
- Use the requested ruleset identifier exactly.

After generating JSON, re-check all attack bonuses, save DCs, damage formulas, defenses, resources, and effect targets against the source.
```

Then append the source stat block and current schema/template/guide content.

## AI safety/reliability rule

AI output is untrusted authoring input.

SimpleVTT should treat AI-generated JSON exactly like hand-authored JSON:

- schema validation;
- semantic validation;
- review;
- explicit activation.

No AI-produced value should bypass these steps.

## Versioning

`schemaVersion` is required.

Breaking changes to field meaning or structure require a new schema version and an explicit migration path. Old definitions should not be silently reinterpreted under a newer incompatible contract.

## Repository content policy

The repository can ship schemas, templates, fictional examples, and legally distributable reference material. User-imported stat blocks remain user data; SimpleVTT does not need to bundle a large proprietary monster/spell database to support the workflow.
