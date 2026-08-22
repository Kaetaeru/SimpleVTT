# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This remains the same active V1-completion run. Do not reset run identity, repeat already source-connected work merely for validation, route implementation to `main`, or start the comprehensive Codex audit before the pre-release boundary.

## Preserved completed/source-connected foundation

Preserve the established Phase 13 connected Character SessionProjection/reconnect/write-back foundation, Ready lifecycle, V1-11 Campaign lifecycle, declarative Calendar/Ration providers, canonical `resolveLongRest()` Character authority, local Long Rest compound coordinator/preview/UI, Character+Campaign prepared-generation foundation, and Memory/Tauri compound persistence/recovery.

The local active-Character Long Rest path remains **SOURCE-CONNECTED / VALIDATION PENDING**. No green claim is authorized without observed exact-head execution evidence.

## 2026-08-23 reconciliation result

The prior handoff recorded local Long Rest head `7e85dc1`, but the actual canonical branch had advanced to `193a4a3fba1384c90addc94596352c7536669eae` before this execution. Those intervening commits already added:

- `connectedLongRestPreflight.ts` with exact owner/Character/Campaign revision approval gating;
- `connectedLongRestTransactionState.ts` with approved -> owner-prepared -> committed -> complete/aborted phases and post-commit recovery semantics;
- durable Character write-back support for canonical recovery-lockout changes;
- related deterministic tests and `test:campaign-rest` wiring.

Therefore those pieces must not be reimplemented.

## Connected Long Rest scope decision

`docs/design/campaign-systems.md` makes connected Long Rest part of V1 rather than an optional expansion. The contract requires Character-by-Character preview, DM/owner decisions, validation, and one authoritative compound commit with no Campaign-only or Character-only durable partial success.

Character ownership remains on the owning Player store. A Host-unknown remote Character may be represented by SessionProjection/roster reference, but must not be copied into the Host Character library merely to reuse the local compound coordinator.

## Completed in this execution

Starting from actual GitHub state, this execution added the transport contract required to continue the distributed flow:

- `d5239f6` — `src/app/connectedLongRestWire.ts`
  - messages: `long-rest-offer`, `long-rest-decision`, `long-rest-owner-prepared`, `long-rest-global-commit`, `long-rest-owner-materialized`, `long-rest-abort`;
  - validates non-empty transaction/session/campaign/owner/preparation IDs, non-negative revisions/advance minutes, and boolean owner/ration decisions.
- `f8a9da1` — `tests/ui/connectedLongRestWire.test.ts`
  - deterministic round-trip coverage for all distributed phases;
  - malformed/negative/non-boolean input rejection.
- `b5fa9a7` — existing `connectedSessionWire.ts` now admits and validates the `long-rest-*` messages through the canonical Session transport codec.

Current exact product head at checkpoint: `b5fa9a7002c0cefafba9e6a7f6d217f7fe379121`.

## Validation status

No green claim.

Before the new commits, exact head `193a4a3` had no combined commit statuses and no commit-associated workflow runs. A direct container clone could not run because the execution container could not resolve `github.com`, so no local `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows result was observed.

The newly added `connectedLongRestWire.test.ts` is authored but has not yet been added to `test:campaign-rest`, and no execution result has been observed.

## Remaining V1-12 implementation gap

The existing source now has the approval gate, transaction phase model, and transport message codec, but not the production distributed coordinator that makes those phases real.

The next implementation must reuse existing connected ownership/reconnect/write-back seams and must provide, in order:

1. Host creates an offer from the current mounted remote Character SessionProjection and exact Campaign revision.
2. Owning Client previews canonical Long Rest and explicitly accepts/declines the exact Character revision.
3. On acceptance, the owner prepares a durable next Character generation without exposing it as committed state and returns a preparation ID.
4. Host prepares/commits the Campaign optional effects only after owner prepare succeeds, using a durable global commit identity/idempotency record.
5. After the global commit point, the owner materializes the already-prepared Character generation; interruption after that point must recover by resending/replaying commit rather than compensating Campaign state.
6. Host/Client projection and Campaign snapshot update only after the relevant durable phase succeeds.
7. Reconnect/retry must be idempotent for offer, prepare, global commit, and materialization.
8. Session-only Rest effect expiry remains transient; do not invent Host-owned durable effect storage.

## Current Next Exact Action contract

On the next Rerun dispatch:

1. Reconcile README -> control -> STATE -> PLAN and the actual `work/v1-composite` head.
2. Check for exact-head validation evidence. If unavailable, do not redo source-connected slices.
3. Add `tests/ui/connectedLongRestWire.test.ts` to `test:campaign-rest` and add canonical Session-wire coverage for at least one valid and one malformed `long-rest-*` envelope.
4. Inspect `characterLibraryPersistence` / Character write-back ports for an existing no-visibility prepared-generation primitive. Reuse it if it exists; do not simulate prepare by committing and rolling back.
5. Implement the smallest owner-side durable prepare/materialize port for connected Long Rest, with deterministic idempotency/recovery tests.
6. Then implement Host distributed coordinator/runtime routing using the existing `preflightConnectedLongRest` and `connectedLongRestTransactionState` state machine; do not persist remote Characters in the Host library.
7. Preserve current UI structure. Add only the minimum owner decision/progress state necessary for the existing Long Rest surface.
8. Keep V1-13 and the comprehensive Codex audit deferred until V1-12 distributed durability is source-connected and checkpointed.
