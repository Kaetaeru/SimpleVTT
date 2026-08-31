# Common Play Visual Reference Plan

Status: **SUPERSEDED / DEFERRED BY OWNER — DO NOT EXECUTE**  
Superseded: 2026-08-31 Asia/Seoul

## Current direction

The earlier image-first Common Play visual rebase is no longer the active work order.

Read instead:

```text
COMMON-PLAY-FUNCTION-FIRST.md
```

The Owner explicitly changed the order of work after reviewing generated base-screen concepts.

Current order:

```text
Common Play functionality first
-> make required behaviors reachable/observable in real Tauri UI
-> verify persistence / multiplayer / reconnect / authority
-> complete representative V1 play journeys
-> inspect the actual working screens and state transitions
-> only then redesign and visually consolidate the UI
```

## Do not do now

- Do not generate the former BASE-01 through BASE-05 set as an implementation prerequisite.
- Do not generate the former REF-01 through REF-10 set as an implementation prerequisite.
- Do not freeze a new whole-product/session layout before the functionality is exercised.
- Do not use previously generated AI mock images as runtime implementation authority.
- Do not rebuild existing systems merely to match a speculative mockup.

## What remains valid

The following product constraints remain valid independently of the deferred visual plan:

- Core Connected Play is mapless.
- Player and DM authority/privacy rules remain canonical.
- Freeform and Initiative use the same underlying runtime rather than separate rules engines.
- UI must eventually expose real human choices, PendingResolution state, authoritative results, blocked/unsupported reasons, recovery state, and required DM/player interactions.
- Character Creation redesign is outside this work.
- Korean-first product presentation remains the V1 direction.

## Historical note

The previous version of this file contained a planning decomposition of:

```text
BASE 5
REF 10
```

That decomposition is retained in Git history only. It is **not** the current execution order and should not be treated as an owner-approved visual specification.

If visual redesign resumes later, reconstruct the reference set from the behavior actually observed in the completed Tauri product rather than assuming the former 15-image structure is still correct.
