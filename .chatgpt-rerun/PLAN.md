# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This is the same V1-completion run. Preserve current Session UI, Character ownership, connected authority/replay, Campaign persistence, and all source-connected Long Rest work. Do not route to `main`, redo implementation solely for validation, or begin the comprehensive Codex audit before the V1 implementation freeze.

## V1-12 contract result

`docs/design/campaign-systems.md` requires connected Long Rest to collect DM/owner decisions and avoid durable Character-only or Campaign-only partial success.

The normal durable-storage implementation path is now source-complete through product-code head `78e829bdfa5b5c8a1de0f8b89c8493e09d7aacc0`:

- visible DM remote Rest offer + Player exact preview/accept/decline in existing Campaign pane;
- Host exact Campaign/owner/Character re-preflight before prepare authorization;
- owner durable invisible Character prepare;
- Windows-safe immutable preparation phase sidecars;
- prepared Character generation Tauri write barrier;
- Host append-only durable owner-prepared coordinator before Campaign global commit;
- stable `<transactionId>:campaign-commit-v1` Campaign commit identity;
- owner materialization only after global commit;
- fresh owner SessionProjection ack and Host remote durable refresh without copying Character ownership;
- post-global Host restart global-commit replay;
- post-global Player restart direct durable marker materialization;
- pre-global Host restart exact abort reconstruction;
- pre-global restarted Player direct durable preparation abort;
- abort replay idempotent after later legitimate Character writes;
- `long-rest-owner-aborted` acknowledgement closes Host durable abort record;
- duplicate abort acknowledgement idempotency;
- focused wire/runtime/UI/restart/write-barrier contracts included in `npm run test:campaign-rest`.

## Validation status

**NO GREEN CLAIM.**

Exact product head `78e829b` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for:

- `npm run test:campaign-rest`;
- `tsc --noEmit` / `npm run build`;
- `cargo test --manifest-path src-tauri/Cargo.toml`;
- Tauri Windows build;
- Windows two-instance restart/reconnect acceptance.

Therefore release-checklist V1-12 remains `PARTIAL` for evidence, despite source implementation completion.

Known exceptional-storage risk: if Host coordinator persistence itself has an I/O failure immediately after owner prepare and the Host also dies before delivering abort, Campaign global commit is not executed, so there is no durable partial success, but the owner can retain an orphan prepared-marker lock. Track this as persistence-failure recovery UX rather than silently treating it as green evidence.

## Next implementation slice

V1-13 Party Stash / Campaign DM Library is next in dependency order because V1-12's implementation boundary is now source-connected. The release checklist's V1-13 `TODO` label is known stale relative to existing runtime/UI methods.

Do not reimplement V1-13 from the label. Audit actual canonical source first and identify only real gaps in:

- durable Campaign namespace/ownership;
- Party Stash item/currency transfer and permissions;
- connected owner write-back / Host authority where relevant;
- DM Library CRUD/search/materialization/privacy;
- Session-visible quick actions;
- Campaign isolation and delete/provenance behavior;
- user-reachable UI and deterministic tests.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check whether exact-head V1-12 focused/TypeScript/Rust execution evidence has appeared. If not, preserve the source-complete implementation and continue rather than rebuilding it.
3. Read the current V1-13 source, tests, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md` plus Campaign Stash/DM Library contract sections.
4. Compare actual implementation against V1-13 acceptance requirements; produce a concrete gap list before edits.
5. Implement the smallest highest-dependency real V1-13 gap with deterministic tests, preserving existing UI language and connected ownership boundaries.
6. Continue remaining V1 implementation slices in dependency order after V1-13.
7. Keep comprehensive Codex audit deferred until implementation freeze; final evidence still requires exact-head regression and Windows two-instance acceptance.
