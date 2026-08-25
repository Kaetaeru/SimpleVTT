# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all source-complete work and validation evidence already recorded by the canonical V1 handoff. Do not repeat Fighter Indomitable or older validated work. Comprehensive Codex audit remains deferred until implementation freeze.

## Reconciliation — 2026-08-26

The previous `blocked` plan was stale. GitHub now proves validated product checkpoint `4a4cdb195ff4544adbb3bfd49487042238b112c1` is reachable and is the merge-base ancestor of `work/v1-composite`.

Current branch was compared directly against `4a4cdb1`: `work/v1-composite` is ahead by 6 commits and behind by 0. The changed paths are coordination/handoff files only; no product-source divergence was reported by that compare.

Therefore the old unpublished-baseline blocker is resolved. Current `control.json=continue` is authoritative. This run/sequence must keep progressing from the latest unfinished canonical checklist item.

## Current execution target

Resume the next canonical implementation slice only:

1. Barbarian Rage start/end.
2. Rage resource spend and action economy.
3. Raging state/status and supported damage resistance.
4. Attack/damage bonus qualification and expiry/end conditions.
5. Connected exactly-once/reconnect/Undo behavior with focused deterministic tests.

Reuse the existing Barbarian resource/runtime/action patterns. Do not add speculative architecture.

## Verification policy

Do not rerun already validated full matrices merely to resume. Run the narrowest Rage-focused deterministic checks required by the changed code, then broader validation only when justified by affected shared paths or the later final-audit boundary.

Do not claim new green execution unless it is actually observed on the relevant exact head.

## Continuation rule

For this same `run_id`, `sequence`, and `task_id`, stale PLAN/STATE status wording must be reconciled forward when `control.json` says `continue`; it must not re-create a blocker by itself. Stop only for a real unrecoverable identity conflict, safety boundary, or unavailable permission required for the next concrete action.
