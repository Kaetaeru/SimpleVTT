# SimpleVTT

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository contains executable D&D SRD 5.2.1 rule/content contracts, a Korean-first application shell, and the current rules-engine integration work.

## Current development gate

Phase 08 implementation issue: #51 — canonical catalog relationships and class/subclass mechanics  
Active PR: #52 — `rules: execute Phase 08 catalog relationships`  
Active branch: `agent/50-rules-phase08`

Phase 08 replaces Phase 07 `catalog-pending` progression choices with canonical stable-ID relationships and mechanics-backed execution. The current branch now has an outermost progression audit covering all 12 classes across levels 2-20 with **zero `catalog-pending` choices**, while preserving explicit rejection for downstream mechanics that require a primitive outside the current engine boundary.

Phase 08 coverage includes:

- generated spell, feat, weapon, and class-skill rule metadata plus stable-ID/provenance persistence
- Expertise, higher-level spell choices, Metamagic, Invocations, Mystic Arcanum, Epic Boons, Weapon Mastery, and Fighting Style progression
- Ranger / Hunter and Paladin / Oath of Devotion progression and representative runtime mechanics
- Cleric / Life Domain, including Divine Intervention and Greater Divine Intervention's executable Wish spell-replication path for supported level-8-or-lower spell mechanics
- Druid / Circle of the Land, including session-scoped current-land configuration and rest-time spell-package reconfiguration
- Fighter / Champion progression/runtime, Weapon Mastery, Fighting Style, and subclass feature relationships
- Barbarian / Path of the Berserker mechanics-backed high-level subclass relationships
- Monk / Warrior of the Open Hand, including Focus projection, Wholeness of Body, Fleet Step, and Quivering Palm contracts
- Rogue / Thief, including Supreme Sneak, Use Magic Device, and Thief's Reflexes contracts
- Bard / College of Lore, including Bardic Inspiration runtime mechanics
- Sorcerer / Draconic Sorcery progression/runtime
- Wizard spellbook/Spell Mastery/Signature Spells plus School of Evocation progression/runtime
- Warlock / Fiend Patron plus Pact Magic, Invocations, Mystic Arcanum, and Pact of the Tome rest configuration

The Phase 08 rules implementation checkpoint is `3832c5a3bbda73e9c5bd946ed3e2a637c2f5b4bb`. Contract validation, Rules Domain, Phase 07/08 aggregate progression, TypeScript, UI runtime gates, and production build are green on that checkpoint.

Issue #51 remains the integration tracker for PR #52. After this stacked PR is integrated, the next implementation gate is Phase 09: converge the executable Phase 08 rules paths into real application/domain services and remove MockAdapter rule calculation from representative play flows.

## Application architecture

The React UI consumes application/ViewModel contracts rather than calculating named rules directly. The current development shell still uses `MockAdapter` as its replaceable application boundary, while Phase 06-08 runtime adapters delegate increasingly large rule paths to the executable domain layer.

```text
React UI
   ↓
Application / ViewModel contracts
   ↓
Runtime adapter boundary
   ↓
Executable rules domain + generated canonical catalogs
```

Phase 09 will converge these paths into the real application/domain adapter and remove remaining MockAdapter rule calculation from representative play flows.

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
