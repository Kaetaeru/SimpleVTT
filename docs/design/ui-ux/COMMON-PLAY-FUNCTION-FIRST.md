# Common Play Function-First Direction

Status: **OWNER OVERRIDE — ACTIVE**  
Effective: 2026-08-31 Asia/Seoul

## Decision

Do **not** design, freeze, or implement a new Common Play visual reference set before the Common Play product behavior is functionally complete enough to observe in the real Tauri product.

The previous BASE/REF image-first plan is deferred.

The working order is now:

```text
existing implementation audit
-> Common Play functional completion / repair
-> real Tauri reachability
-> persistence / reconnect / multiplayer authority verification
-> complete playable journeys
-> observe the actual working UI and state transitions
-> then redesign / simplify / polish UI from real behavior
-> Owner visual review
-> final visual freeze
```

## Why

Common Play contains stateful interactions whose real shape is easier to design correctly after they are executable: target selection, allocation, costs/payment, pending resolutions, reactions, consent, DM adjudication, authoritative results, persistent effects/artifacts, long activities, correction/undo, unsupported states, reconnect and privacy.

Designing the whole UI before those flows are reachable risks inventing screens, controls, state, or information hierarchy that does not match the actual runtime contract.

## Current UI rule

Until the function-first gate is complete:

- reuse existing Tauri UI wherever possible;
- add only the **minimum UI required to operate and observe a real behavior**;
- visual inconsistency or temporary layout is acceptable if the behavior is clear enough to test;
- do not perform a broad shell/session visual redesign;
- do not create a replacement visual architecture around AI-generated reference images;
- do not treat previously generated Common Play mock images as implementation authority;
- do not redesign Character Creation;
- preserve mapless Core and existing authority/privacy constraints.

## Functional visibility requirement

A feature is not considered product-reachable merely because the domain/runtime implementation exists. Each required Common Play behavior must have enough UI to:

1. discover or trigger it when appropriate;
2. provide required human input;
3. show waiting/pending state when resolution pauses;
4. show the authoritative result/state change;
5. explain blocked/unsupported/DM-assisted states when relevant;
6. recover correctly after reconnect/restart where required.

The UI may be provisional during this phase.

## Common Play functional families to make reachable first

These are behavior families, not a new implementation checklist. Reuse existing implementation and only repair proven gaps.

1. capability/action discovery and execution;
2. eligibility and unavailable reasons;
3. dynamic choices;
4. single/multi target selection;
5. allocation across targets;
6. cost/payment preview and commit semantics;
7. PendingResolution visibility;
8. reaction/interrupt responses;
9. consent interactions;
10. DM-assisted adjudication;
11. authoritative dice/result presentation;
12. damage/healing/resource/economy state changes;
13. conditions/effects/runtime artifacts;
14. long cast / activity process state;
15. Activity/provenance/explainability;
16. DM correction / compensating undo;
17. unsupported vs DM-assisted distinction;
18. reconnect/retry/exactly-once behavior;
19. role/privacy projection;
20. Freeform/Initiative continuity.

## Evidence gate before broad UI redesign

Broad visual redesign should resume only after the working product can demonstrate representative end-to-end behavior for the families above and the V1 acceptance work has established the actual reachable flows.

At that point, visual design should start from **screenshots / behavior observed in the working Tauri product**, plus canonical product/domain constraints, rather than speculative complete-screen AI mockups.

## Relationship to previous visual plan

`COMMON-PLAY-VISUAL-REFERENCE-PLAN.md` is superseded as an active work order. Its former BASE 5 + REF 10 decomposition remains historical brainstorming only and may be reused later if it still matches the finished behavior.

No previously generated Common Play image is approved, frozen, or authoritative.
