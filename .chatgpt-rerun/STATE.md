# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- canonical head reconciled: `7a6d7a4b91b1455034a3d4d441d8e9ea5964ca93`
- active work branch: `codex/v1-barbarian-rage`
- active issue: `#124` — R1 Barbarian Rage lifecycle
- active draft PR: `#125`
- latest product fix before coordination writes: `0fe59b17da87f0357657f2599b2052f41978f537`
- PLAN checkpoint commit immediately before this STATE update: `13a90d8d93fcad53ec6930ff53593a1898062867`
- checkpointed_at: `2026-08-26T03:32:34+09:00`

## Reconciliation performed

This resume read the Rerun files in the required order (`README.md -> control.json -> STATE.md -> PLAN.md`), then checked canonical root, V1 handoff/release checklist, branch heads, PR #125, and CI.

Canonical `work/v1-composite` advanced from the prior product base only by `chore(rerun): rearm after watchdog stop`; product code did not advance. The R1 working branch remained the authoritative unfinished product line.

Do not repeat already-validated Rage domain mechanics, actual Rage Damage integration, local Session Rage projection, or the previous full Rules Domain / Phase 11 checkpoints.

## Connected Rage work completed in this sequence

The deterministic regression `tests/ui/connectedBarbarianRage.test.ts` is present and explicitly included in `.github/workflows/phase12-connected.yml`.

Before the current fix it already passed through:

- remote projected Barbarian owner authorization;
- Host action routing and authoritative resolution commit;
- one Rage Resource spend;
- owning-client ResolutionEvent apply and active Rage presentation;
- duplicate ActionRequest and duplicate event idempotency;
- reconnect cursor with no replay/double spend.

Two earlier RED boundaries were resolved without introducing a parallel system:

1. Projected Barbarian absent from TurnRuntime — fixed by reusing `addTurnRuntimeCombatant` in the existing Rage adapter.
2. Test accidentally remained in Initiative with a different current actor — corrected to the intended connected Freeform contract.

The final RED was Host Undo: the inverse runtime/event history was created, but the mounted remote Character's durable Rage Resource remained `1` instead of restoring to `2`.

Root cause was generic persistence ownership, not Rage mechanics. `characterSessionProjectionPersistenceGuard.ts` only examined `state.activeCharacter`, while the connected router restores the Host-local Character after a remote commit.

Product fix `0fe59b17da87f0357657f2599b2052f41978f537` now:

- detects projected durable write-back targets from canonical state changes with `writeBack:"character"`;
- uses the existing SessionProjection registry sheet when Host-local Character context is active;
- updates the projected registry without switching the Host-local active Character;
- rejects ambiguous multi-projected-owner write-back instead of silently choosing one.

No Rage-specific transport, duplicate persistence model, or new mechanics authority was added.

## Verification status

- Prior intentional RED Phase 12 run: `32881268426`.
- That run reached the new connected Rage test and failed only at Host Undo durable projected Rage Resource restoration after all earlier exactly-once/reconnect assertions passed.
- No new Phase 12 run exists yet for `0fe59b1` because PR #125 became `mergeable=false` after canonical independently changed `.chatgpt-rerun/control.json` during the watchdog re-arm.
- The canonical conflict is coordination-only: both branches changed the same `control.json` timestamp line from the old common base.

## Current unfinished point / Next Exact Action

1. Write `control.json` last for this checkpoint, preserving `status: continue` and incorporating the canonical watchdog re-arm reason.
2. Create a coordination-only merge commit with the working head tree and canonical `7a6d7a4b...` as the second parent, then fast-forward `codex/v1-barbarian-rage` to it. This resolves ancestry/mergeability without changing product files.
3. Verify PR #125 is mergeable and that the Phase 12 connected-session workflow is created for the reconciled head.
4. Inspect the focused connected job. If GREEN, record the run as the completed connected Rage exactly-once/reconnect/Undo checkpoint.
5. Keep PR #125 Draft and evaluate any remaining explicit R1 acceptance gap before closing Rage.
