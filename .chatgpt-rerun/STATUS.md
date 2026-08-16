# Rerun Status

**Connection:** `main` · Phase 14 authorized

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch: `main`
- Planned work branch: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control transition: `continue` pending final authoritative write
- Tracking issue: #108

## Human summary

Phase 14 is now the active product-completion phase. Its goal is to replace the reference-fixture-dependent production play path with a genuine persisted Character -> session -> Scene actor/actions flow and carry that through to an exact-head Windows playable build.

The user specifically requires strong in-session UX: a single play workspace with first-class `행동`, `기술`, `주문`, and `인벤토리` surfaces. Skills must roll through authoritative dice/provenance, and inventory items must be inspectable/usable during the session without leaving play.

The discovered root cause is that `AppProvider` still delegates through a reference-seeded `MockAdapter`; newly authored Characters are persisted but are not reliably materialized as live Scene actors with their own derived action surface. Existing green Phase 11 tests exercised reference ids and therefore did not prove the real user journey.

Phase 13 network authority and durable write-back subsystems remain preserved. Phase 14 will reconcile the actual Character into those proven runtime boundaries rather than replacing them.

`STATUS.md` is human-facing only; dispatch/reconciliation remains README → control → STATE → PLAN.
