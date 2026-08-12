# SimpleVTT

SimpleVTT is a local-first D&D play assistant focused on reducing routine combat arithmetic and rules-state bookkeeping while preserving player and DM decisions.

The planned application uses Tauri + React + TypeScript and is designed to support offline Character management plus DM-hosted LAN/Hamachi sessions without a central cloud account service.

## Design baseline

The current pre-implementation architecture is documented in:

- [`docs/design/README.md`](docs/design/README.md) — product/architecture canon and document index.
- [`docs/rules/README.md`](docs/rules/README.md) — Common Rule Definition Specification `0.1-draft`.
- [`docs/guides/combatant-json-import.md`](docs/guides/combatant-json-import.md) — Combatant JSON authoring/import guide.

Core principles include:

- automate arithmetic, preserve human choices;
- source-by-source provenance for important calculations;
- declarative RuleSource/Predicate/Timing/content data;
- one ResolutionEvent/StateChange model for Freeform and Initiative;
- player-owned permanent Characters with DM-hosted shared session authority;
- default and homebrew content using the same validated mechanics pipeline;
- no arbitrary executable rule scripts in imported content;
- scenario-driven extension after real playtesting.

Implementation has not started yet. The next gate is selecting and minimally specifying the initial D&D RulesProfile, then building a narrow offline vertical slice before networking.
