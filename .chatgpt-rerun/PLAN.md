# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `blocked`

Preserve all source-complete work and validation evidence already recorded by the canonical V1 handoff. Do not repeat Fighter Indomitable or older V1-13 work. Comprehensive Codex audit remains deferred until implementation freeze.

## Preflight reconciliation — 2026-08-26

The watcher re-read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled actual `work/v1-composite`, `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and the available design/source paths.

The old Rerun checkpoint was stale: it recorded product boundary `9632f5119be427c200b5e1aa92a432df7edd27ca`, while actual GitHub branch HEAD is `7a6d7a4b91b1455034a3d4d441d8e9ea5964ca93`.

The current canonical V1 handoff is newer than the old Rerun state and is authoritative for remaining work. It records:

- validated local product checkpoint `4a4cdb195ff4544adbb3bfd49487042238b112c1`;
- full TS matrix `1303/1303` green and production build green at that exact checkpoint;
- Fighter Indomitable complete within the preserved source-complete set;
- next implementation slice: Barbarian Rage lifecycle;
- critical source-of-truth caveat: checkpoint `4a4cdb1` is local-only and the handoff explicitly says it cannot be claimed as pushed to `work/v1-composite`.

The GitHub branch re-fetch immediately before this coordination write still resolves to `7a6d7a4b91b1455034a3d4d441d8e9ea5964ca93`. No concurrent branch advance was observed during this execution.

## Blocker

Do not implement Barbarian Rage against the older product tree currently reachable from GitHub. Doing so would fork below the handoff's validated `4a4cdb1` baseline and risk duplicating or discarding verified work.

This execution cannot reconstruct unpublished local commits from the GitHub connector. Local clone/fetch from this environment also lacks usable repository credentials, so the missing product checkpoint cannot be recovered here without an authoritative pushed ref/commit.

The handoff also references `docs/design/session-action-resolution.md` and `docs/design/limited-feature-resources.md`, but those paths are absent from the current GitHub branch. Treat those pointers as stale until the validated product checkpoint is published/reconciled.

## Next Exact Action

1. From the workspace that contains validated checkpoint `4a4cdb195ff4544adbb3bfd49487042238b112c1`, restore GitHub credentials and reconcile `work/v1-composite` without rewriting verified history.
2. Push or otherwise publish the exact validated product lineage so `4a4cdb1` and its required descendants are reachable from the canonical GitHub branch/ref.
3. Re-fetch GitHub and prove the canonical product baseline contains the handoff's validated checkpoint before any new product edit.
4. Re-arm this same run/sequence by changing control from `blocked` back to `continue` once that source-of-truth repair is complete.
5. Then implement the next canonical slice only: Barbarian Rage start/end, supported damage resistance, attack/damage qualification and expiry cadence, resource/action economy, manual end, connected exactly-once/reconnect/Undo, with focused deterministic tests.

Do not repeat validated Indomitable work and do not claim new executable verification until it is actually run on the reconciled exact head.
