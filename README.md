# SimpleVTT

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository contains executable D&D SRD 5.2.1 rule/content contracts, a Korean-first application shell, and the current rules-engine integration work.

## Current development gate

Active issue: #53 — Phase 09 mechanics integration / RealAdapter convergence  
Active PR: #54 — `app: converge Phase 09 mechanics into RealAdapter services`  
Active branch: `agent/53-mechanics-phase09`  
Stacked base: Phase 08 PR #52 / `agent/50-rules-phase08`

Phase 08 is complete at the catalog/class-mechanics boundary. Its outermost progression audit covers all 12 SRD classes across target levels 2-20 with **zero `catalog-pending` choices**. Unsupported downstream execution shapes still reject explicitly rather than being approximated.

Phase 09 now moves representative play paths out of MockAdapter-owned rule calculation and into shared application/domain services while keeping the current UI/ViewModel contracts stable.

Current Phase 09 integration coverage includes:

- targetless/freeform ability checks through a generic domain `openD20` resolver without inventing a DC
- attack hit/critical previews through the canonical d20 resolver, including natural 1 and natural 20 semantics
- typed attack damage through the domain damage resolver, including resistance, vulnerability, immunity, Temporary HP, and HP ordering
- Action / Bonus Action / Reaction and class-resource costs through atomic `ResolutionEvent` transactions with rollback on invalid resource spend
- healing state application through the domain healing resolver
- an end-to-end Second Wind representative path: healing + Bonus Action + class resource + Activity provenance/state changes + Undo restoration
- saving throws use explicit target-bound reference modifiers instead of index-derived Mock bonuses, and each target is resolved by the canonical d20 resolver
- saving-throw damage uses the same typed domain damage path, including save-half, resistance, and Temporary HP ordering
- Phase 08 zero-pending, aggregate progression, TypeScript, and production UI regression gates remain green

Latest Phase 09 integration checkpoint:

```text
37e5f7b5a4d6b507fdb7789cf3a1d28af6ee5b40
```

On that checkpoint, Contract validation, Rules Domain, Phase 07/08 aggregate progression, Phase 09 service/adapter tests, TypeScript, and the UI production build are green.

## Application architecture

The React UI consumes application/ViewModel contracts rather than calculating named rules directly. During Phase 09, `MockAdapter` remains transitional fixture/state storage, while rule calculation is moved behind shared application services backed by the executable rules domain.

```text
React UI
   ↓
Application / ViewModel contracts
   ↓
Phase 09 application services
   ↓
Executable rules domain / ResolutionEvent transactions
   ↓
Transitional state projection into the current adapter shell
```

The next Phase 09 slices are fully atomic staged attack transactions, moving reference save facts to real Character/Combatant runtime stats, ItemInstance charge/quantity transactions, real initiative/turn runtime state, and direct Activity/Undo projection from committed domain events.

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

Install dependencies and run the browser application:

```sh
npm install
npm run dev
```

Run the desktop shell:

```sh
npm install
npm run tauri:dev
```

Run the main verification gates:

```sh
npm run test:rules-domain
npm run test:progression
npm run build
```

Reference-only state controls are intentionally hidden from normal Player/DM screens. Press `Ctrl+Shift+D` to open the developer dock and switch reference role, session mode, current actor, queued d20 value, or connection state.

## Repository contracts

Machine-readable rules and content contracts live under `rules/`, `content/`, `schemas/`, `templates/`, `examples/`, and `docs/`. Generated application catalogs are derived from those canonical sources; runtime logic must not parse presentation prose to determine rules behavior.
