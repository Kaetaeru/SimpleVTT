# Gate E — Spatial Fact / Manual Authority Execution Packet

Status: **FROZEN FOR IMPLEMENTATION**
Parent plan: `docs/rules/resolver-execution-checklist.md`
Integration target: `work/v1-composite`

## Concrete repository evidence

Gate E does not require a geometry engine or a new named-content execution path.

The persisted Common Play contract already contains the structural concepts needed for most of the gate:

- `FactQuery` with declared authority, visibility, and unknown policy;
- `Interaction` with blocking input and responder semantics;
- `InteractionInput.type = targets` for manual affected-target selection;
- `Selector` for deterministic target selection;
- `movement.relocate.destinationFact` for semantic destination validation;
- `adjudication.request` for explicit authority input.

The current runtime does not execute those fact queries/target-set interactions. Existing targeting instead expects already-resolved distance/visibility/cover facts, and existing movement operations are semantic but do not orchestrate `destinationFact`.

A concrete builtin spell-authoring example (`dnd-srd-5.2.1.spells-a-core`, Acid Splash) already carries range/area authoring data, while the persisted Common Play `Selector` currently has no typed place for instantaneous area shape/range metadata. That is the only Gate-E schema gap identified before implementation.

## Bounded architecture

### 1. Generic fact registry

Trusted application/RulesProfile code registers supported fact kinds and their value type. Imported JSON may reference a registered fact kind but cannot define executable evaluators.

Minimum value families required by Gate E:

- boolean — range/visibility/legal yes-no facts;
- number/string — profile/provider facts where needed;
- targets — deterministic affected-target ID set;
- destination — opaque semantic destination/result reference supplied by provider/manual authority; Core does not interpret coordinates.

Do not hard-code spell/feat/class/item IDs in the registry.

### 2. One fact-answer boundary

Provider and manual authority must converge on the same typed answer envelope:

- query identity;
- fact kind;
- typed value;
- provenance (`provider` or `authority` plus responder/provider identity);
- causation/resolution identity.

Core consumes the answer; it does not care whether it came from geometry automation or a person.

### 3. Unknown policy

Existing `FactQuery.unknownPolicy` remains authoritative:

- `request-authority` -> produce a blocking generic authority request;
- `block` -> unresolved/blocked result;
- `treat-false` -> only legal for registered boolean facts;
- `unsupported` -> explicit unsupported result.

No silent defaults.

### 4. Interaction/retry semantics

Reuse the existing Common Play interaction identity/revision pattern:

- stable interaction ID + idempotency key;
- expected authoritative revision;
- stale response policy;
- duplicate response/event is a no-op or deterministic rejection, never a second commit;
- connected transport routes the response to the authoritative Host/session; it does not decide rules semantics.

Do not create a feature-specific network message for range, visibility, area, or movement.

### 5. Targeting facts are demand-shaped

`TargetFacts` must not require fabricated distance/visibility/cover values. A targeting rule that declares a range constraint requires a range/distance fact; a rule with no sight/cover constraint must not require fake sight/cover data merely to run mapless.

### 6. Instantaneous area metadata

Add only the smallest declarative metadata required to preserve an instantaneous area request through normalized Common Play. Core stores/passes it but does not calculate geometry.

The metadata must be finite and typed, not arbitrary executable JSON. It must support the Gate-E proof shapes without becoming a full tactical-map geometry DSL.

Provider-backed affected-target resolution and manual target selection return the same `targets` answer. Instantaneous areas never create a temporary Zone just to select actors.

### 7. Movement

`movement.relocate.destinationFact` uses the same fact runtime. Provider/manual authority supplies the semantic legal result/destination. The existing movement resolver remains the mutation path; Gate E must not add geometry calculation to Core.

## Required red proofs

Before the fix is considered green, executable tests must demonstrate current failure/gap for:

1. **E1 range** — unknown external rule cannot currently execute a registered range fact through provider/manual parity.
2. **E2 visibility** — unknown external rule requests visibility; no provider/manual answer must not be silently invented.
3. **E3 area** — unknown external instantaneous area requires an affected-target set; manual/provider paths converge and no Zone artifact is created.
4. **E4 destination** — unknown external relocation asks for legal destination; same fact-answer boundary drives provider/manual paths.

At least one proof must change only content ID/name and retain identical semantics.

## Implementation constraints

- no new named execution adapter;
- no feature-specific transport message;
- no Core raycast, point-in-shape, coordinate, pathfinding, or LOS computation;
- no arbitrary executable provider code imported from RuleModule JSON;
- no fake Zone for instantaneous areas;
- no unrelated migration work before Gate E closes;
- preserve typed StateChanges and authoritative commit semantics;
- preserve existing Gate A-D behavior.

## Verification

Required exact-candidate evidence:

- focused Gate E domain tests;
- impacted Gate A-D Common Play regressions;
- canonical TypeScript typecheck;
- connected-session regression if the generic authority response path changes;
- production/UI build only if touched;
- exact SHA, command, environment, pass/fail counts, workflow/job IDs.

Owner-approved merge remains required before Gate E is marked DONE.
