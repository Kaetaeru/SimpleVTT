# Documentation archive

Files under this directory, and the explicitly listed legacy documents below, are retained for historical evidence, auditability, and old PR/phase context. They are **not current routing or implementation instructions**.

## Current sources of truth

- Project status: [`../CURRENT.md`](../CURRENT.md)
- Current V1 roadmap: [`../roadmap/V1_MASTER_ROADMAP.md`](../roadmap/V1_MASTER_ROADMAP.md)
- Evidence ledger: [`../roadmap/V1_EVIDENCE_LEDGER.json`](../roadmap/V1_EVIDENCE_LEDGER.json)
- Current roadmap pointer: [`../roadmap/CURRENT.md`](../roadmap/CURRENT.md)
- Branch routing: [`../../CANONICAL_ROOT.md`](../../CANONICAL_ROOT.md)

## Explicitly completed / historical material

- `../CODEX_C9_GATE_N_HANDOFF.md` — **COMPLETE / HISTORICAL**. C9 Gate N was integrated by PR #186; any `Next Exact Action` inside that handoff is obsolete.
- C9 finalization/reconciliation branches and issue #185 — **COMPLETE / HISTORICAL**.
- Phase 11/12/13/14 planning and handoff material — **HISTORICAL EVIDENCE**, not a current work queue unless referenced by a live V1 Gate.
- The former `.github/workflows/apply-phase14-player-experience-redesign.yml` self-publishing workflow — **REMOVED during W0**. Do not restore branch-writing automation as the normal implementation loop.
- Pre-cleanup `.agents` handoffs/checklists — historical snapshots only; current V1 work is selected from the 72-gate roadmap.

## Archive policy

- Preserve historical material when it may contain useful evidence; prefer archival classification over treating it as current.
- Do not create a new `NEXT`, current handoff, or competing roadmap inside the archive.
- A historical filename such as `CURRENT_WORK`, `V1_CURRENT_HANDOFF`, `PHASE14_CHECKLIST`, `CODEX_C9_GATE_N_HANDOFF`, or `resolver-execution-checklist` remains historical even if the name sounds current.
- Git history and GitHub PR/Actions evidence remain valid audit sources, but they do not override the current routing documents above.
- Any future product-code repair begins with `docs/roadmap/EVIDENCE_CARD.md` and current-HEAD evidence.

`agent-workspace-2026-08-28/` is a lossless snapshot of the pre-cleanup `.agents` workspace. `rules/` contains superseded Resolver execution packets/checklists moved out of the live rules documentation surface.
