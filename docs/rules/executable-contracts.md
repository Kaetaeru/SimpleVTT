# Executable Rules Contracts

The first machine-readable rules contracts live alongside the design canon:

- `rules/profiles/dnd.srd-5.2.1.profile.json` — SRD 5.2.1 RulesProfile registries and policies.
- `content/modules/dnd-srd-5.2.1.core/module.json` — Korean-first default SRD RuleModule manifest skeleton.
- `schemas/rules-profile.schema.json` — RulesProfile contract.
- `schemas/rule-module.schema.json` — RuleModule manifest contract.
- `schemas/content-entry.schema.json` — content identity, localization, relationships, extension points, progression contributions, and mechanic envelope.
- `schemas/localized-presentation.schema.json` — localized names/descriptions and translation provenance.
- `schemas/golden-scenario.schema.json` — deterministic rules fixture envelope.
- `tests/fixtures/rules/` — first golden scenarios.

## Validation

Install the small development-only validator dependency and run:

```bash
python -m pip install -r requirements-dev.txt
python tools/validate_contracts.py
```

The validator checks every `*.schema.json` as JSON Schema Draft 2020-12, validates the SRD profile and module manifest, validates all current golden-scenario fixtures, and keeps the existing Combatant example/template under schema validation.

The JSON contracts are deliberately smaller than the complete design vocabulary. New persisted primitives should be added only when a concrete failing scenario requires them.
