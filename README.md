# SimpleVTT

> [!IMPORTANT]
> **Canonical V1 development root:** `work/v1-composite`
>
> All current V1 implementation, builds, previews, tests, and follow-up AI work must use this branch. `main` and `work/v1-latest` are historical/landing references and must not be treated as the latest playable build. See [CANONICAL_ROOT.md](./CANONICAL_ROOT.md).

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository contains executable D&D SRD 5.2.1 rule/content contracts, a Korean-first application shell, and the current rules-engine integration work.

## Current development gate

Active issue: #53 — Phase 09 mechanics integration / RealAdapter convergence  
Active PR: #54 — `app: converge Phase 09 mechanics into RealAdapter services`  
Active branch: `agent/53-mechanics-phase09`  
Stacked base: Phase 08 PR #52 / `agent/50-rules-phase08`

Phase 08 is complete at the catalog/class-mechanics boundary: the outermost progression audit covers all 12 SRD classes across target levels 2-20 with **zero `catalog-pending` choices**.

Phase 09 is moving representative play paths out of MockAdapter-owned calculation and into shared application/domain services while preserving current UI/ViewModel contracts. `MockAdapter` remains transitional fixture/state storage while authoritative rule evaluation moves into the rules domain.

Current Phase 09 integration coverage includes:

- targetless/freeform checks through a generic domain `openD20` resolver without inventing a DC
- attack hit/critical semantics through canonical d20 resolution, including natural 1/20 behavior
- target-bound saving throws through canonical d20 resolution rather than index-derived Mock modifiers
- typed damage through the domain damage resolver, including resistance, vulnerability, immunity, Temporary HP, and HP ordering
- generic validated fixed-dice formulas used by structured healing and item damage rolls
- Action / Bonus Action / Reaction + class-resource costs through atomic `ResolutionEvent` transactions with rollback
- ItemInstance quantity and charge costs projected through the same atomic resource/economy transaction model
- Second Wind: structured healing + Bonus Action + class resource + Activity + Undo
- Thunderwave: per-target saves + save-half + typed damage + resistance/Temp HP + Action cost
- Shortbow: staged preview with one authoritative `resolveAttack` transaction for targeting, d20, critical dice, typed damage, and Action economy
- Healing Potion: `2d4+2` healing + quantity/Action transaction + Undo
- Wand: `3d4+3` structured damage + typed health application + charge/Action transaction + Undo
- Phase 08 zero-pending, aggregate progression, TypeScript, and production UI regression gates remain green

Latest verified Phase 09 integration checkpoint:

```text
60b9dff44c20b8f752ec2c800e2d9ad6df882006
```

On that checkpoint, Contract validation, Rules Domain, Phase 07/08 aggregate progression, Phase 09 service/adapter tests, TypeScript, and the UI production build are green.

## Application architecture

```text
React UI
   ↓
Application / ViewModel contracts
   ↓
Phase 09 application services
   ↓
Executable rules domain / ResolutionEvent transactions
   ↓
Transitional projection into the current adapter shell
```

The next Phase 09 work is replacing transitional reference facts with real Character/Combatant runtime stats, moving Initiative/turn economy/Reaction/movement authority into `RulesRuntimeState`, expanding atomic attacks where authoritative spatial data exists, and projecting Activity/Undo directly from committed domain events.

## Frontend

- React 19 + TypeScript
- Vite 8
- Korean-first UI
- Player and DM surfaces share the same entity/action contracts with different authority
- Complete SRD-backed level-1 Character Creation slice
- Phase 07/08 level-up uses `ChoiceDefinition`-backed deterministic progression plans
- Canonical 339-spell Korean-first presentation catalog

## Desktop shell

- Tauri 2
- Desktop-first window
- Local-first architecture; production persistence and authoritative LAN/networking are later gates

## Run the application

Requirements:

- Node.js 22 recommended
- Rust stable toolchain for Tauri development
- Tauri platform prerequisites for your operating system

```sh
npm install
npm run dev
```

Desktop shell:

```sh
npm install
npm run tauri:dev
```

Main verification gates:

```sh
npm run test:rules-domain
npm run test:progression
npm run build
```

Reference-only state controls are intentionally hidden from normal Player/DM screens. Press `Ctrl+Shift+D` to open the developer dock and switch reference role, session mode, current actor, queued d20 value, or connection state.

## Repository contracts

Machine-readable rules and content contracts live under `rules/`, `content/`, `schemas/`, `templates/`, `examples/`, and `docs/`. Generated application catalogs are derived from those canonical sources; runtime logic must not parse presentation prose to determine rules behavior.
