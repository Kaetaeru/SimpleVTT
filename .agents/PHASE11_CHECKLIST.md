# Phase 11 — Complete Offline Playable Vertical Slice

Tracking issue: #101
Branch: `agent/101-offline-playable-vertical-slice`
Base checkpoint: `35205203d040bbf80ceaa2e01c434dbf85a6fc0a` (Phase 10 complete)

Phase 11 closes only when the verified head also produces a retrievable Windows playable artifact.

## Production composition

- [ ] one shared offline runtime adapter bootstrap is used by production and the deterministic walkthrough gate
- [ ] Phase 09 rules/runtime/event adapters and Phase 10 persistence/content adapters remain in the production order
- [ ] no remote transport implementation is introduced; host/client transport remains post-Phase-11 work

## Offline Character lifecycle

- [ ] Character create -> durable save -> fresh-repository restore
- [ ] representative progression/subclass path and progression choice contracts remain executable
- [ ] multiclass-capable progression contracts stay green
- [ ] equipment / ItemInstance / resource durable mutation -> restart restore

## Offline resolution/runtime

- [ ] Freeform ability/save/action/spell/item resolution
- [ ] Initiative start / turn economy / end-turn flow
- [ ] attack / typed damage / healing / conditions / Concentration
- [ ] reaction / interrupt flow
- [ ] representative class/subclass runtime E2E
- [ ] Combatant import -> instantiate -> action resolution
- [ ] DM adjudication/correction
- [ ] authoritative Activity / dice / provenance
- [ ] safe event-native Undo / revision consistency

## Deterministic product gate

- [ ] dedicated Phase 11 offline walkthrough passes on the production adapter composition
- [ ] existing UI gate remains green
- [ ] existing Rules Domain gate remains green
- [ ] existing Persistence gate remains green
- [ ] existing Contract validation gate remains green
- [ ] production frontend build remains green
- [ ] Windows Tauri executable builds from the exact verified Phase 11 head
- [ ] CI uploads the Windows playable artifact and it is retrievable
- [ ] Draft PR checkpoint

## Product handoff

- [ ] artifact contains `SimpleVTT.exe` and build metadata identifying the exact commit
- [ ] artifact is provided to the owner immediately when Phase 11 closes

## Boundaries

- Core remains map/grid/token/path/LOS free; movement UI remains an optional module boundary.
- Do not invent target/DC/rule facts when authoritative facts are missing.
- Do not serialize `AppSnapshot` as durable Character state.
- Session-only state remains session-only.
- Unsupported mechanics remain explicit blockers.
- Owner progression acceptance PR #60 remains Draft until owner Windows walkthrough verification; this human gate is separate from the automated Phase 11 product artifact.