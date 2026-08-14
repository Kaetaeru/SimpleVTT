# SRD 5.2.1 catalog compiler

This directory builds generated builtin catalog modules from a pinned SRD/localization checkout.

## Rules
- Stable IDs and mechanics are language-independent.
- ko-KR presentation comes from the pinned `Kaetaeru/D-D-2024-` checkout.
- Prose is never interpreted at runtime.
- Extraction and executable semantics are separate: Markdown/frontmatter/tables provide presentation and source facts; reviewed semantic maps provide mechanics.
- Missing localization and unsupported mechanics stay explicit.
- Generated output must be deterministic for the same source lock and semantic maps.

## Pipeline
1. Read `source-lock.json`.
2. Extract reviewed presentation/frontmatter/tables from the translation checkout.
3. Join explicit semantic maps under `tools/srd521/semantics/`.
4. Emit category RuleModules under `content/modules/`.
5. Validate schema, stable IDs, references, localization coverage, and capabilities.
6. Emit `content/modules/dnd-srd-5.2.1.catalog-report.json`.

The first vertical slice is Fighter. It proves class progression, current-level choices, resources/actions, and subclass unlock boundaries before scaling to all classes and the large spell/item/monster bundles.
