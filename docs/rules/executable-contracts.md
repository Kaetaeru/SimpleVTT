# Executable Rules Contracts

The first machine-readable rules contracts live alongside the design canon:

- `rules/profiles/dnd.srd-5.2.1.profile.json` — SRD 5.2.1 RulesProfile registries and policies.
- `content/modules/dnd-srd-5.2.1.core/module.json` — Korean-first default SRD RuleModule manifest skeleton.
- `schemas/rules-profile.schema.json` — RulesProfile contract.
- `schemas/rule-module.schema.json` — RuleModule manifest contract.
- `schemas/content-entry.schema.json` — content identity, localization, relationships, extension points, progression contributions, and legacy authoring mechanic envelope.
- `schemas/common-play-contract.schema.json` — normalized executable Common Play Contract v0.2 with typed operations, casting/payment, selectors/bindings, interactions, interceptors, artifacts, and lifetime semantics.
- `docs/rules/common-play-contract-v0.2.md` — persisted executable-content boundary and migration/runtime rules for the v0.2 contract.
- `schemas/localized-presentation.schema.json` — localized names/descriptions and translation provenance.
- `schemas/golden-scenario.schema.json` — deterministic rules fixture envelope.
- `tests/fixtures/rules/` — runtime/profile golden scenarios.
- `tests/fixtures/play-contract/` — structural Common Play Contract v0.2 coverage fixtures.

## Validation

Install the small development-only validator dependency and run:

```bash
python -m pip install -r requirements-dev.txt
python tools/validate_contracts.py
```

The validator checks every `*.schema.json` as JSON Schema Draft 2020-12, validates the SRD profile and module manifests, validates the golden-scenario and Common Play Contract fixtures, and keeps the existing Combatant example/template under schema validation.

The JSON contracts are deliberately smaller than the complete design vocabulary. New persisted primitives should be added only when a concrete failing scenario requires them.
