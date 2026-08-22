# Movement and Map Module Policy

Status: canonical design policy

## Core policy

SimpleVTT core does **not** provide or own a movement, battle-map, token-position, grid, pathfinding, collision, line-of-sight, or 3D scene system.

The default product must remain fully usable without a map module. Core UI therefore does not expose token dragging and `SimpleVttAdapter` does not expose a default `moveActor` command.

This is an ownership boundary, not a removal of rules support. The rules domain may still model movement allowance, movement restrictions, range, visibility, cover, and other spatial facts when another system supplies the required facts.

## Extension goal

A future 2D grid module, 3D scene module, or other spatial module should reuse prepared host functions instead of reimplementing D&D movement legality or combat targeting rules.

A movement module owns:

- coordinates and transforms;
- token/entity placement;
- drag/drop or other movement UX;
- grid snapping and unit conversion;
- path measurement/pathfinding;
- terrain/collision representation;
- line-of-sight computation;
- cover derivation;
- the post-move pairwise spatial snapshot.

Core owns only the narrow module-facing validation/application seam:

- validate module identity and submitted facts;
- validate that the submitted spatial snapshot is complete for currently tracked relations;
- when Initiative movement enforcement is requested, pass the reported distance through the rules-domain `move` operation;
- project pairwise distance/visibility/cover/sight facts for attack and spell targeting;
- preserve provenance identifying which module supplied those facts.

Core does not derive the spatial facts itself.

## Stable module-facing contract

The module-facing payload is deliberately coordinate-system agnostic.

```ts
interface MovementModuleCommand {
  moduleId: string;
  actorId: string;
  distanceFeet: number;
  spatialUpdates: MovementSpatialUpdate[];
  destinationMovesCloserToVisibleFrighteningSource?: boolean;
  visibleSourceIds?: string[];
}
```

`MovementSpatialUpdate` contains only rules-relevant facts such as pair distance, visibility, cover, and mutual sight. It does not contain 2D or 3D coordinates.

Modules call the prepared `MovementModuleHost.apply(...)` / `applyMovementModuleCommand(...)` hook. Core itself never originates this command. The current Phase 09 host applies this hook to an active Initiative runtime; future map modules may add a separate freeform spatial-update capability without introducing turn economy into Freeform.

## Manual movement-triggered reactions

Because mapless Core does not observe token paths, it must not infer opportunity attacks or other movement-triggered reaction attacks.

When no movement module supplies an authoritative trigger, the **current-turn controller** explicitly declares the movement reaction from the Scene UI. In other words, whoever currently controls the moving/provoking Actor is responsible for pressing the manual reaction-input button when movement caused a reaction window.

The current Phase 09 input records:

- the current moving/provoking Actor;
- the reacting Actor;
- the attack Action used as the reaction;
- trigger kind (`opportunity attack` or another manually described movement reaction attack);
- authoritative distance, visibility, cover, and mutual-sight facts at the trigger instant.

This manual declaration is an input fact, not an automatic ruling. Core still validates the submitted facts against the selected attack and runtime state. Reaction availability, targeting/range/sight legality, attack roll, critical handling, typed damage, life state, Activity, and Undo remain authoritative rules-domain work.

A manual reaction attack is committed atomically: the domain Reaction spend and the attack are one transaction. If targeting or attack application is rejected, the Reaction spend rolls back as well. The reaction attack does not consume the reactor's normal Action.

Future 2D/3D modules may originate the same trigger through a module integration seam. They must not receive a separate rules implementation; manual input and module-generated triggers converge on the same reaction/attack transaction boundary.

## Default behavior without a module

Without a movement/map module:

- no movement controls are shown;
- no token coordinates are stored or simulated by core;
- no pathfinding or grid calculations occur;
- `SimpleVttAdapter` exposes no default movement command;
- the current-turn controller may explicitly input movement-triggered reaction attacks;
- distance/visibility/cover labels and related disabled reasons are not fabricated;
- missing distance is `unknown`, never `out-of-range`, and otherwise valid manual targets remain selectable;
- only current, explicitly entered manual facts or facts from an active validated provider may be used by rules resolution;
- a rule that fundamentally requires a module-owned operation is inactive/unsupported with a capability reason instead of approximating that operation.

If a provider disconnects, fails capability validation, or is disabled, all live facts whose provenance belongs to that provider are invalidated. Stale module distance, visibility, cover, or path facts must not continue to filter targets or block actions.

## Relationship to RuleModule

A movement/map module is **not** a declarative `RuleModule` content package. `RuleModule` remains the content/rules composition mechanism and cannot execute arbitrary code.

A future executable module/plugin system may host 2D/3D presentation capabilities, but it must connect to rules through this narrow fact-and-command boundary rather than mutating rules state directly.

## Invariants

1. Core remains mapless by default.
2. 2D and 3D modules use the same coordinate-agnostic host contract.
3. A visual/spatial module cannot silently change rules formulas.
4. Rules code never parses presentation-only distance labels.
5. Missing spatial facts do not become negative facts: unknown range/visibility/cover cannot disable an otherwise valid manual target.
6. Module-supplied spatial facts carry module provenance.
7. Initiative movement legality remains authoritative in the rules domain when a movement module asks core to enforce it.
8. Core does not persist or assume a particular coordinate system.
9. Core never auto-detects an opportunity attack without authoritative movement-trigger input.
10. Manual and module-originated movement reaction attacks converge on the same authoritative Reaction + attack transaction.
11. Provider removal invalidates its live spatial facts and restores mapless fallback immediately.
