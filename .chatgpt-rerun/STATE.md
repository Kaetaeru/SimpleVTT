# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T09:08:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order before project work. The records reconciled to the same run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md` reconfirmed `work/v1-composite`. Pre-execution branch HEAD was `2c68844495f6ab3073cadf3fa684c6926436f30b`. GitHub returned no combined statuses and no commit-associated workflow runs for that head. Existing distributed Long Rest implementation was preserved rather than rebuilt.

The V1 contract was rechecked: connected compound Long Rest must collect owner/DM decisions, prevent durable Campaign-only or Character-only success, and support replay/idempotency. The remaining precommit double-restart cleanup was therefore completed rather than excluded.

## Preserved foundation

Keep intact:

- canonical Character Long Rest rule/projection authority;
- local Character+Campaign compound Rest persistence/recovery;
- connected SessionProjection Character ownership, Host authority, reconnect/event replay;
- visible connected Rest UI in existing Session Campaign pane;
- owner durable invisible preparation marker + Windows-safe immutable phase sidecars;
- Host append-only durable coordinator;
- stable Campaign global commit identity;
- post-global Host/Player process-restart recovery;
- prepared-generation Tauri normal-write barrier;
- remote Character never becomes Host-owned durable Character data.

## Completed in this dispatch

### 1. Exact precommit abort recovery identity

- `1014ced297f51978e76a9b8175b6e635b6f9607e` — `long-rest-abort` can carry an all-or-none ownerParticipantId + Character revision + preparationId recovery tuple.
- `667fec2c9b2c545b4916457ae2f0d17b53036fe0` — restarted Tauri owner can abort the exact durable preparation without ClientRecord state.
- `669b253365626459e86cdba6ed80bacdbe9cf7c1` — Host durable aborted records retain the real preparationId; no placeholder identity remains; Host recovery abort/global-commit messages include exact owner/preparation identity.
- `6fafcbc99bc6cb9f436b2bc96d51ba7a874b7f95` — session transport routes enriched Host abort and falls back to restarted-owner durable abort when ClientRecord is gone.
- `d46920d4a41c25d8bfc37fcf104195f09dd0a37f` — abort recovery wire contract coverage.
- `27e3947db3d1b4e5e9afba186d809885f5e79c74` — Host restart deterministic coverage proves committed and precommit-aborted replay retain exact preparation identity.

### 2. Restart durability suite wiring

- `1f9cd4f1a9bfd2a83b1c567288867310654d5afe` — restart/write-barrier structure contract authored.
- `29e802e5184d2a61512bdf3c6e2baea630f542d0` — Host restart and restart durability structure contracts added to `npm run test:campaign-rest`.

### 3. Owner abort cleanup acknowledgement

Source review found that successful owner abort cleanup still left the Host durable aborted record, causing indefinite replay.

- `07f53436fbc4e8852e93a3a251409ac91c8d424e` — added exact `ConnectedLongRestOwnerAborted` identity.
- `0a35024605d2ef7ce0a0cdd20e806a4f9c338491` — wire adds `long-rest-owner-aborted` acknowledgement.
- `5358c895fcd3f30371d7b1227a23edde74f0c1af` — Host validates exact abort ack and deletes durable coordinator state.
- `4b4095ab1e8e3498370a62fe5b82f334b3a84512` — Player sends owner-aborted only after local/durable cleanup; Host receives the ack.

### 4. Abort replay idempotency after later Character writes

A second retry edge was found: if the abort ack was lost, the first cleanup could unlock normal Character writes, and a later Host abort replay previously rejected because current runtimeRevision no longer equaled the old prepared revision.

Rust `abort_at()` already checks an existing `.aborted` sidecar before checking current generation, so the durable marker is the correct source of truth.

- `98b6c38a5491f127b57852fc145128e7d4d8abc4` — restarted owner abort no longer pre-rejects later runtime revision. It captures current revision before abort and verifies the abort operation itself does not change Character state.
- `318df6a49d2a0af946dda08f67f867e48f85b556` — wire tests cover owner-aborted ack and malformed acknowledgement.
- `9f31e05bfb5adeebc889ae2b5a3477b5eb3fe6fc` — Host restart test covers durable abort closure.
- `26476f66ce1cee78244ddbab91a775dead6d6ddc` — restart durability structure contract updated for ack/replay semantics.

### 5. Duplicate owner-aborted acknowledgement idempotency

Network duplicate delivery must not turn a completed abort into an error.

- `b43d5b1062280219bb35a5280c22e57fa49fb159` — after durable Host coordinator deletion, the in-memory Host transaction remains `aborted-complete`; recovery replay skips completed outcomes and duplicate exact acknowledgements remain idempotent.
- `af9eb5105c9089f03ac61111a1377e15597ade81` — deterministic Host restart contract invokes the exact abort acknowledgement twice and expects convergence.
- `78e829bdfa5b5c8a1de0f8b89c8493e09d7aacc0` — structure test locks current idempotent abort acknowledgement state.

Exact product-code head before coordination docs: `78e829bdfa5b5c8a1de0f8b89c8493e09d7aacc0`.

### 6. Canonical handoff reconciled

- `.agents/V1_CURRENT_HANDOFF.md` was updated after the product slice so future agents do not follow its obsolete pre-connected-Rest instructions.
- It now records V1-12 distributed Long Rest as source implementation complete / validation pending and routes next implementation work to a real-source audit of V1-13.

## Current V1-12 assessment

For the normal healthy durable-storage path, connected Long Rest is now **SOURCE IMPLEMENTATION COMPLETE / VALIDATION PENDING**.

Source-connected transaction lifecycle:

1. DM visible remote Rest offer;
2. owner exact preview/immutable decision;
3. Host exact authority re-preflight;
4. explicit prepare authorization;
5. owner durable invisible Character prepare;
6. Character generation write barrier while prepared;
7. Host durable owner-prepared coordinator write;
8. Campaign global commit with stable idempotency identity;
9. owner materialization only after global commit;
10. fresh owner SessionProjection acknowledgement;
11. Host durable remote projection refresh while Session transient authority survives;
12. post-global Host/Player restart recovery;
13. pre-global Host/Player double-restart abort recovery;
14. abort ack loss/replay idempotency;
15. exact owner-aborted acknowledgement closes Host durable recovery state;
16. duplicate ack convergence.

The Host never persists the remote Character in its Character library.

## Validation status

**NO GREEN CLAIM.**

Exact product head `78e829b` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed result exists for:

- `npm run test:campaign-rest`;
- `tsc --noEmit`;
- `npm run build`;
- `cargo test --manifest-path src-tauri/Cargo.toml`;
- Tauri build;
- Windows two-instance Host/Player restart/reconnect acceptance.

Source-authored tests are not execution evidence. Release checklist V1-12 remains `PARTIAL` until exact-head validation/release evidence exists.

## Known risk outside the normal durable-storage path

If Host receives owner-prepared but the Host coordinator durable write itself fails because of storage I/O, Campaign global commit is not attempted. If the Host then also dies before abort delivery, there is no durable partial success, but the owner can retain an orphan prepared marker/write-barrier lock because the Host could not durably remember the transaction. This is a persistence-failure recovery/error-UX edge, not a green transaction path. Preserve it as a known release-quality risk; do not misreport it as solved or as Campaign/Character partial success.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check newly observable V1-12 exact-head focused/TypeScript/Rust evidence. If still unavailable, do not reimplement Connected Long Rest.
3. Start V1-13 by auditing actual current Party Stash / Campaign DM Library source and tests before editing. The release checklist `TODO` label is stale relative to existing implementation.
4. Read the V1-13 Campaign sections plus `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md` and identify concrete gaps in persistence, permissions, connected ownership/write-back, privacy, Session quick actions, isolation, delete/provenance, and visible UX.
5. Implement only the smallest real unblocked V1-13 gap with deterministic tests.
6. Continue remaining implementation slices in dependency order; keep comprehensive Codex audit deferred until implementation freeze.
