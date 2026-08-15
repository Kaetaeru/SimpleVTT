# SimpleVTT

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository contains executable D&D SRD 5.2.1 rule/content contracts, a Korean-first application shell, and the current rules-engine integration work.

## Current development gate

Active issue: #51 — Rules Engine Phase 08, canonical catalog relationships and class/subclass mechanics  
Active PR: #52 — `rules: execute Phase 08 catalog relationships`  
Active branch: `agent/50-rules-phase08`

Phase 08 replaces Phase 07 `catalog-pending` progression choices with canonical stable-ID relationships and mechanics-backed execution. The current branch includes generated spell/feat/weapon/class-skill metadata, executable level-up choices, representative class/subclass mechanics, and runtime projection through the application adapter boundary.

Recent Phase 08 coverage includes:

- Ranger and Paladin progression, Fighting Styles, prepared-spell relationships, and representative class mechanics
- Cleric and Life Domain progression/runtime, including Divine Intervention and Greater Divine Intervention's executable Wish spell-replication path for supported level-8-or-lower spell mechanics
- Druid and Circle of the Land mechanics, including rest-time land package reconfiguration
- Fighter and Champion progression/runtime, Weapon Mastery, Fighting Style, and subclass feature relationships
- Bard and College of Lore, including Bardic Inspiration runtime mechanics
- Sorcerer and Draconic Sorcery progression/runtime
- Wizard spellbook/Spell Mastery/Signature Spells plus School of Evocation progression/runtime
- Warlock Pact Magic, Invocations, Mystic Arcanum, and Pact of the Tome rest configuration
- Epic Boon progression from the generated canonical feat catalog

The remaining Phase 08 work is tracked in issue #51. In particular, Circle of the Land's mutable current-land choice still needs to move from durable character data into an explicit rest/session configuration state, and unsupported mechanics remain explicit blockers rather than silent approximations.

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
