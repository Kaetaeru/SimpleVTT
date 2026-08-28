# SimpleVTT

SimpleVTT is a local-first desktop companion for D&D play. It combines a Korean-first player/DM application with declarative SRD 5.2.1 content, a generic rules engine, local Character persistence, and Host/Client session authority.

## Start here

Repository documentation has one reading order:

1. [`docs/CURRENT.md`](docs/CURRENT.md) — what the project is doing now, active branches/PRs, and the next boundary.
2. [`docs/architecture/README.md`](docs/architecture/README.md) — stable architecture map and source-of-truth links.
3. [`docs/roadmap/CURRENT.md`](docs/roadmap/CURRENT.md) — current execution-plan router.
4. [`CANONICAL_ROOT.md`](CANONICAL_ROOT.md) — branch/integration routing.

Historical phase plans, superseded handoffs, and old agent notes are archived under [`docs/archive/`](docs/archive/). They are evidence, not current instructions.

## Product direction

The rules system is converging on a declarative execution model:

```text
RuleModule / content data
  -> validation + normalization
  -> Common Play operations / IR
  -> RulesProfile semantics
  -> PendingResolution
  -> generic Resolver
  -> typed state changes + ResolutionEvent
  -> atomic authoritative commit
  -> persistence / session projection / UI
```

Content identity is for provenance and presentation, not algorithm selection. New runtime behavior should not be implemented as named spell/class/feat/item branches when a reusable rules primitive can express it.

## Repository layout

- `src/` — application and domain implementation
- `tests/` — domain, UI, persistence, connected-session, and contract regressions
- `rules/` — machine-readable RulesProfiles and rule data
- `content/` — declarative content modules/catalog inputs
- `schemas/` — machine-readable contracts
- `docs/` — current product/architecture documentation and archive
- `.chatgpt-rerun/` — automation coordination state only
- `.agents/` — machine baselines required by structural gates; not a product-plan source of truth

## Run

Requirements: Node.js 22 recommended; Rust stable and Tauri platform prerequisites for desktop development.

```sh
npm install
npm run dev
```

Desktop:

```sh
npm run tauri:dev
```

Main verification entry points:

```sh
npm run test:rules-domain
npm run test:progression
npm run build
```

Use the narrower workflow/test named by `docs/CURRENT.md` for an active slice before repeating broad historical validation.
