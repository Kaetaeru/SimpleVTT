# Declarative Module Activation Validation

This Phase 10 boundary connects the repository's existing `rule-module.schema.json`, `content-entry.schema.json`, and `rules-profile.schema.json` semantics to installed-content activation. It does not introduce executable module loading.

## Existing contract reuse

The validator reuses these existing meanings:

- RuleModule identity: `moduleId` + `moduleVersion`;
- RuleModule dependencies/conflicts: exact `moduleId` + `version` references;
- RulesProfile identity/version and declared capability/content-category surface;
- ContentEntry `requiresCapabilities`;
- ContentEntry relationships: `parent`, `extends`, `replaces`, with optional `targetVersion` and `extensionPoint`;
- extension points declare accepted content categories.

The current RuleModule schema does not define semver ranges. Therefore dependency validation is exact-version validation. Range syntax must not be invented in application code without a schema evolution.

## Activation order

A reviewed local entry is normalized into the Step 5 installed-content representation, including optional declarative module metadata. Before any durable generation is written, the validator checks the candidate against the active RulesProfile and already installed declarative metadata.

Blocking validation means activation stops before persistence and the reviewed preview remains available for correction/retry.

## Validation rules

The current validator rejects:

- RulesProfile ID/version mismatch;
- a content category outside the active profile's category surface;
- missing exact module dependency;
- declared module conflict in either direction;
- missing required capability;
- module dependency cycles;
- missing or ambiguous relationship targets;
- `extends` without an extension point;
- missing extension point or rejected extension category;
- content relationship cycles;
- multiple active entries replacing the same resolved target.

Load order never resolves these failures.

## Identity and persistence

Step 5 qualified catalog identity remains authoritative:

```text
(contentId, sourceId, version)
```

Module validation metadata is additive data on installed entries. Existing Step 5 entries without an explicit module manifest remain readable and are treated as a synthetic declarative source using `sourceId` + entry version, with no dependencies/conflicts. This preserves backward compatibility without claiming that legacy entries originally carried richer manifest semantics.

Invalid candidate metadata is never committed as a new installed-content generation.

## Capability ownership

The active RulesProfile is loaded from the repository's canonical profile JSON. Required content capabilities must be present in the active profile/module capability surface. Arbitrary executable-code capability remains unsupported.

## Relationship ownership

Portable relationship targets use stable content IDs, optionally narrowed by target version. If the active catalog contains multiple matches after that narrowing, validation reports ambiguity rather than selecting by load order.

`extends` additionally requires the target to expose the named extension point and the extension point to accept the candidate category.

`replaces` is explicit. Multiple active replacements of one resolved target are a blocking conflict until a future policy explicitly models selection.

## Boundaries

This validation layer is declarative only. It does not:

- load JavaScript/native/WASM plugins;
- execute imported code;
- introduce a generalized plugin registry;
- add movement/map/grid/token/path/LOS ownership to Core;
- invent version-range or load-order conflict semantics not present in the schemas.
