# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical target branch: `work/v1-composite`
- Working branch: `codex/v1-barbarian-rage`
- Tracking issue: `#124` — R1 Barbarian Rage lifecycle
- Draft PR: `#125`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

## Authority and reconciliation

Mandatory Rerun read order is `README.md -> control.json -> STATE.md -> PLAN.md`. Then reconcile actual GitHub branch/PR/CI state with `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`. Actual GitHub state wins stale embedded SHAs or prose.

Canonical `work/v1-composite` is now `7a6d7a4b91b1455034a3d4d441d8e9ea5964ca93`; the only change after the prior product base is the Rerun watchdog re-arm in `.chatgpt-rerun/control.json`. No canonical product code advanced.

Do not replay already-GREEN V1-13, Indomitable, Rage domain/attack work, or the local Session Rage action checkpoint.

## Current active slice

R1 remains **Barbarian Rage lifecycle**. The connected remote-owner acceptance regression is now present at `tests/ui/connectedBarbarianRage.test.ts` and is included in the Phase 12 connected-session gate.

Already proven before the current RED:

- remote owner authorization and Host authority;
- exactly one Rage Resource spend and authoritative Host event;
- owning-client event apply and active Rage projection;
- duplicate ActionRequest/event idempotency;
- reconnect from acknowledged event cursor without replay/double spend.

The remaining RED was Host Undo: runtime/event history reversed correctly, but the durable Rage Resource stayed spent on the mounted remote SessionProjection.

Root cause: `characterSessionProjectionPersistenceGuard.ts` routed durable write-back only through `state.activeCharacter`. After a remote resolution completed, the connected router restored the Host-local Character context before Undo, so inverse write-back could not find the original projected owner.

Minimal production fix committed at `0fe59b17da87f0357657f2599b2052f41978f537`:

- route projected durable write-back by `writeBack:"character"` state-change `targetId` when the active Character is not projected;
- read/write the existing projected Character registry; do not mutate Host-local Character context;
- reject a single write-back that ambiguously spans multiple ephemeral projected owners;
- no Rage-specific transport, persistence schema, or mechanics branch added.

## Next Exact Action

1. Preserve the required durable write order for this checkpoint: `PLAN.md -> STATE.md -> control.json`.
2. Reconcile the canonical Rerun re-arm commit into the working branch history so PR #125 becomes mergeable again; this is coordination-only and must not alter product code.
3. Let the existing PR `pull_request` workflow execute the Phase 12 connected-session gate on the reconciled head. Do not re-run already-GREEN Rules Domain/Phase 11 work unless the new diff actually affects it.
4. If the focused connected Rage regression is GREEN, verify the Phase 12 job conclusion and record the evidence.
5. Then assess whether R1 has any explicit remaining acceptance gap. Keep PR #125 Draft until the complete R1 boundary is satisfied.

## Resume invariants

- Actual GitHub state wins stale checkpoint prose.
- Deterministic regression first; smallest adequate production diff.
- Reuse existing adapters/services; do not create a second mechanics authority.
- SRD 5.2.1 Rage has no voluntary end action/API.
- Connected Player requests remain owner-authorized and Host-authoritative.
- Retries, reconnect, and Undo must be exactly-once with durable Character state aligned to canonical ResolutionEvents.
- Preserve post-Rage order: Wild Shape -> Monk Focus -> Rogue Cunning Action/Uncanny Dodge unless canonical planning changes it.
