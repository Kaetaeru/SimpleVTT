# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T08:14:00+09:00`

## Preflight reconciliation

This execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the required order and reconciled the same run/sequence/task with `continue` authorization. `CANONICAL_ROOT.md` still declares `work/v1-composite` canonical.

The actual branch state superseded the stale implementation checkpoint in the prior handoff: before new writes, canonical HEAD was `193a4a3fba1384c90addc94596352c7536669eae`, 21 commits after recorded local Long Rest head `7e85dc1`.

Those intervening source changes already contained connected Long Rest ownership/revision preflight, distributed transaction phase state, durable recovery-lockout write-back support, and related deterministic tests. They were inspected and preserved rather than reimplemented.

## Scope determination completed

`docs/design/campaign-systems.md` establishes connected Long Rest as a V1 requirement:

- Character-by-Character Rest preview;
- DM / owning-player decisions;
- exact validation before commit;
- one authoritative compound transaction;
- no durable Character-only or Campaign-only partial success.

The same contract keeps Character durable ownership on the owning Player store. Host-unknown remote Characters may use SessionProjection and Campaign roster references, but must not become Host-owned Character records.

Therefore V1-12 remains PARTIAL and requires a connected/distributed Long Rest path.

## Existing connected foundation preserved

Do not redo:

- canonical local `resolveLongRest()` / `projectCharacterLongRest()`;
- local Character+Campaign compound preview/commit and SessionCampaignPane UI;
- Tauri Character+Campaign compound recovery foundation;
- remote Character SessionProjection reconstruction and Host authority;
- owning-client durable ResolutionEvent write-back;
- reconnect/event-cursor replay;
- `connectedLongRestPreflight.ts` exact owner/Character/Campaign revision gate;
- `connectedLongRestTransactionState.ts` approved -> owner-prepared -> committed -> complete/aborted state machine.

## Work completed in this execution

### Connected Long Rest transport contract

- `d5239f60e359a69cc7b58f686496f7a7f60a910f` — added `src/app/connectedLongRestWire.ts`.
  - `long-rest-offer`
  - `long-rest-decision`
  - `long-rest-owner-prepared`
  - `long-rest-global-commit`
  - `long-rest-owner-materialized`
  - `long-rest-abort`
  - structural rejection of empty identity fields, negative revisions/minutes, and invalid booleans.
- `f8a9da18917d6544c273ddb45d041bf12ebd48c4` — added `tests/ui/connectedLongRestWire.test.ts` with phase round-trip and malformed-input contracts.
- `b5fa9a7002c0cefafba9e6a7f6d217f7fe379121` — integrated `long-rest-*` validation into the canonical `connectedSessionWire.ts` codec so these messages can traverse the existing Session transport envelope.

Exact product-code head before Rerun checkpoint document writes: `b5fa9a7002c0cefafba9e6a7f6d217f7fe379121`.

## Validation status

**NO GREEN CLAIM.**

For pre-execution exact head `193a4a3`:

- GitHub combined commit statuses: none returned;
- commit-associated workflow runs: none returned.

A direct container clone was attempted but failed because that execution container could not resolve `github.com`; therefore no local `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows execution result was observed.

The new `connectedLongRestWire.test.ts` is authored but is not yet wired into `test:campaign-rest` and has not been observed passing.

## Remaining exact gap

The source has approval gating, a recovery-aware transaction state machine, and transport messages, but the distributed states are not yet backed by production persistence/runtime routing.

Required remaining behavior:

1. Host offer uses current mounted remote SessionProjection + exact Campaign revision.
2. Owning Client produces authoritative Rest preview and accepts/declines exact revisions.
3. Accepted owner prepares a next durable Character generation without making it visible/committed and returns a preparation ID.
4. Host commits Campaign optional effects only after owner prepare, with durable transaction idempotency/global commit identity.
5. After global commit, owner materializes exactly the prepared Character generation; post-commit interruption recovers by replay/resend rather than compensation.
6. Retry/reconnect is idempotent across every phase.
7. UI/Scene/Campaign projections update only after the appropriate durable phase.
8. Session-only Rest effect expiry remains transient.

## Next Exact Action

1. Mandatory reconcile README -> control -> STATE -> PLAN and actual branch head.
2. Check exact-head validation evidence; if unavailable, do not redo existing slices.
3. Add `connectedLongRestWire.test.ts` to `npm run test:campaign-rest` and extend `connectedSessionWire.test.ts` with valid/malformed `long-rest-*` canonical codec cases.
4. Inspect Character persistence/write-back code for an existing true prepared-generation/no-visibility primitive.
5. Reuse that primitive if present. If absent, add the smallest owner-side prepare/materialize port with deterministic stale/idempotency/recovery tests; never emulate prepare by committing then rolling back.
6. Wire owner prepare/materialize and Host global commit through `connectedSessionRuntimeAdapter` using the existing preflight and transaction-state machine.
7. Do not store remote Character data in the Host Character library.
8. Preserve the current UI baseline and defer V1-13/final Codex audit until this V1-12 distributed durability gap is source-connected.
