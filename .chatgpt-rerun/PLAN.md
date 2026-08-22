# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This is the same V1-completion run. Preserve existing exact-head evidence and source-connected work. Do not route implementation to `main`, redo completed slices merely for validation, or start the comprehensive Codex audit before the pre-release boundary.

## Preserved foundation

Do not reimplement:

- Phase 13 Character SessionProjection / Host authority / reconnect / owner write-back;
- Ready lifecycle and connected action authority;
- V1-11 Campaign lifecycle;
- declarative Calendar/Ration provider paths;
- canonical `resolveLongRest()` / `projectCharacterLongRest()`;
- local active-Character Long Rest compound preview/commit/UI;
- Character+Campaign Memory/Tauri compound persistence and recovery;
- connected Long Rest owner/Campaign revision preflight;
- connected Long Rest transaction state machine;
- owner durable invisible Character prepare/materialize/abort marker and TS ports.

## Completed in the current dispatch

Starting from canonical HEAD `8ed0199296333188a69dd08e62e3940b82b53b5e`, this dispatch source-connected the distributed connected Long Rest runtime through exact product-code head `3c14aebff0e5983204eaae8ae552c674d726826c`.

### Explicit Host prepare authorization

`connectedLongRestWire.ts` now includes `long-rest-prepare-authorized` carrying the exact `ConnectedLongRestCommitPreflight`. Owner staging cannot begin merely because the owner said yes; Host must first revalidate current Campaign, owner and mounted Character revisions.

Owner materialization now carries a fresh `CharacterSessionProjectionV1` so Host can update only the remote durable Character projection after owner commit.

### Host Campaign participant / global commit

`longRestCompoundCoordinator.ts` exposes `previewLongRestCampaignParticipant()` so connected play can reuse existing Calendar/Ration/idempotency authority without pretending the remote Character is a Host Character.

`connectedLongRestCampaignPersistence.ts`:

1. validates the exact approved Campaign revision;
2. calculates optional Calendar/Ration changes through existing Campaign authority;
3. stamps the master transaction id;
4. writes one Campaign generation only after owner prepare;
5. treats that write as the irreversible global commit point;
6. returns a stable Campaign commit identity;
7. never reclassifies a successful durable write as abortable merely because runtime projection/rehydration failed afterward.

### Distributed runtime phase orchestration

`connectedLongRestRuntimePort.ts` now models Host and owner state for:

- offer;
- owner preview/accept/decline;
- Host re-preflight;
- prepare authorization;
- owner durable prepare;
- Host Campaign global commit;
- owner materialization;
- Host completion;
- precommit abort;
- same-process retry/reconnect replay.

The owner Character is never inserted into Host Character persistence.

`characterSessionProjectionMount.ts` adds durable refresh for an already mounted remote Character. HP/resources/life/actions refresh from the owner projection while Host Session initiative/status/distance/economy remain authoritative.

### Production transport

`connectedLongRestSessionAdapter.ts` is loaded after the canonical connected Session adapter from `src/main.tsx`.

- It advertises `connected-long-rest-v1` through the existing mutable capability manifest source.
- It installs a dedicated Tauri message listener rather than rewriting the large canonical dispatcher.
- It routes decision -> prepare authorization -> owner prepared -> global commit -> owner materialized/complete.
- `hello`/`hello-ack` trigger deferred same-process recovery replay after the canonical listener reconciles participant/session identity.
- post-global failures produce recovery warnings and never compensating aborts.
- `AppSnapshot.connectedLongRest.ownerPrompts` projects pending owner decisions.
- production adapter methods `startConnectedLongRest(...)` and `respondConnectedLongRest(...)` exist, but no React UI calls them yet.

### Deterministic contracts

New/updated tests cover:

- prepare authorization wire envelope;
- owner materialized projection envelope;
- Host Campaign global commit, duplicate retry and stale precommit rejection;
- full distributed phase ordering;
- Character invisibility before global commit/materialization;
- Campaign Calendar/Ration commit before owner materialization;
- owner Character commit after global commit;
- Host remote durable projection refresh while Session transient authority survives;
- remote Character absence from Host Character library;
- stale Campaign precommit abort;
- recovery-message phase selection.

`npm run test:campaign-rest` includes the new Campaign participant and distributed runtime suites.

## Validation status

**NO GREEN CLAIM.**

At preflight GitHub returned no combined statuses and no commit-associated workflow runs. A direct `git clone --branch work/v1-composite --depth 1` was attempted again and failed with `Could not resolve host: github.com`. Therefore no local `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows execution result exists for this exact head.

Do not repeat the source-connected implementation solely to obtain validation.

## Remaining V1-12 gap

### 1. Production user path

The distributed runtime is not yet reachable from visible UI.

Next UI work must preserve the current Session layout:

- DM: smallest compatible control in the existing Campaign/Rest area to offer Long Rest to a connected remote Character, reusing current +8h / ration opt-ins;
- Player: small owner decision state using `snapshot.connectedLongRest.ownerPrompts`, showing HP/temp-HP preview and Accept/Decline;
- after decision, show progress/recovery state without allowing a changed decision mid-transaction.

Do not redesign Session UI or create a separate full-screen Rest workflow.

### 2. Host process-restart durability

Current Host transaction records are transient `WeakMap` state. Same-process reconnect/retry is covered, but after the Host Campaign global commit a Host process restart cannot reconstruct the exact preflight / owner preparation relationship from `recentRequestIds` alone.

Before V1-12 DONE, determine and implement the smallest durable coordinator record required to recover a committed distributed Long Rest after Host restart, or prove from the canonical V1 contract that process-restart recovery is outside the required transaction interruption boundary. Do not silently assume it away.

### 3. Exact-head validation

Focused TS/build/Rust/Tauri/Windows execution remains pending.

## Next Exact Action

On the next Rerun dispatch:

1. Read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite` HEAD.
2. Check exact-head validation evidence. If unavailable, preserve the current distributed implementation and continue.
3. Source-review `connectedLongRestRuntimePort.ts`, `connectedLongRestSessionAdapter.ts`, `connectedLongRestCampaignPersistence.ts`, and `connected_long_rest_character.rs` for any compile/contract issue before adding UI.
4. Add the minimal existing-UI integration:
   - DM connected remote Character Rest offer control;
   - Player HP/temp-HP preview + accept/decline;
   - transaction phase/status display.
5. Add UI structure/runtime tests proving the visible path calls `startConnectedLongRest` / `respondConnectedLongRest` and does not replace the existing Session layout.
6. Audit the Host process-restart recovery gap. If V1 requires post-global crash recovery, add a durable Host coordinator marker with enough exact preflight/preparation/global-commit identity to resend global commit safely after restart. Never compensate an already committed Campaign.
7. Only after connected Long Rest is user-reachable and recovery semantics are source-complete, reconcile V1-12 status and proceed to V1-13.
8. Keep the comprehensive Codex audit deferred.
