# Phase 14 Checklist — Production Play Session

Tracking issue: #108
Base: `main` at `f2a88a96e38f30334256ec071178b11bb342fcdb`
Branch: `agent/108-production-play-session-ux`

## Product target

A persisted/user-created Character must be able to enter a real local or connected session and use the visible UI for skill checks, attacks/features, spells, inventory/items, initiative/freeform play, authoritative dice, activity/undo, DM combatants, and host-authoritative connected actions.

## P14.1 Production actor materialization

- [ ] Add Character -> SceneEntity projection for the active persisted Character.
- [ ] Derive playable attacks/actions without fixture Character ids.
- [ ] Reconcile after hydration/create/edit/level-up/write-back via the outer production adapter chain.
- [ ] Preserve real connected SessionProjection authority and host/client durable ownership.
- [ ] Make no-actor/no-target states safe instead of assuming `char.aelar` exists.

## P14.2 Real play dice

- [ ] Production browser/Tauri d20 uses actual random faces when no explicit queued test face is present.
- [ ] Node regression fixtures retain deterministic replay.
- [ ] Visual dice remain presentation-only and replay authoritative results.

## P14.3 In-session UX

- [ ] Add a persistent Play launcher/dock that works from Character Library/Sheet without debug controls.
- [ ] Provide `행동`, `기술`, `주문`, `인벤토리` tabs in one play context.
- [ ] Preserve selected target/session/turn context while switching tabs.
- [ ] Show disabled reasons and provenance/details.

## P14.4 Skills

- [ ] Derive the standard skill list from Character abilities and proficiency.
- [ ] Skill tiles show governing ability, total modifier, proficiency state, and source.
- [ ] Skill roll routes through authoritative ability-check resolution and Activity/provenance.
- [ ] Freeform skill checks do not consume Initiative Action economy.

## P14.5 Inventory

- [ ] Inventory opens during play without leaving the session.
- [ ] Equip/unequip and attune/unattune are available where legal.
- [ ] Consumable/charged item actions are exposed in play and use authoritative item-cost resolution where mechanics are supported.
- [ ] Durable item state persists through the owning Character library.

## P14.6 Spells and feature actions

- [ ] Real Character spell/action surfaces do not rely on Mira/Aelar ids.
- [ ] Existing spellcasting/resource runtime remains authoritative.
- [ ] Feature/resource actions expose availability and cost.

## P14.7 Local/DM session flow

- [ ] Active Character can enter local play immediately after creation or hydration.
- [ ] DM can instantiate Combatants into the live Scene and select/use actors.
- [ ] Freeform/Initiative/turn/condition/reaction/correction/undo regressions remain green.

## P14.8 Connected flow

- [ ] Host/Join uses the same production active Character projection.
- [ ] Host-unknown Character mounts ephemerally and is usable through the visible play surface.
- [ ] Remote UI action resolves on host, committed event converges, owner write-back persists.

## P14.9 Product-realistic gates

- [ ] Fresh non-fixture Character integration: author/save -> play actor -> skill roll -> action/item interaction -> Activity/state update.
- [ ] Restart/hydration -> same Character enters play with durable state.
- [ ] UI structure gate for Play launcher and four tabs.
- [ ] No product-critical gate requires Ctrl+Shift+D/reference scenario loading.
- [ ] Relevant Phase 11/12/13 regressions remain green.

## P14.10 Windows playable

- [ ] Exact-head Main Playable workflow is green.
- [ ] Windows Tauri persistence/transport tests are green.
- [ ] Artifact includes `SimpleVTT.exe`, `BUILD.txt`, and updated local + connected walkthrough.
- [ ] Artifact exact head and SHA-256 are verified before delivery.
