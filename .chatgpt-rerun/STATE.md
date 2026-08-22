# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T08:32:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the required order and reconciled the same run/sequence/task with `continue` authorization.

`work/v1-composite` was still canonical. Pre-execution HEAD was `8ed0199296333188a69dd08e62e3940b82b53b5e`. GitHub returned no combined statuses and no commit-associated workflow runs for that head.

No source-connected Long Rest foundation from prior dispatches was rebuilt.

## Preserved foundation

Keep intact:

- local canonical Long Rest domain/application/UI path;
- Character+Campaign local compound persistence and Tauri recovery;
- connected Character SessionProjection / Host authority / reconnect / owner ResolutionEvent write-back;
- connected Long Rest exact owner/Character/Campaign preflight;
- connected transaction state machine;
- connected owner Tauri durable invisible prepare/materialize/abort marker;
- TS owner preparation/persistence ports and deterministic tests.

Connected Long Rest remains required by the Campaign V1 contract; remote Character durable ownership remains on the owning Player store.

## Completed in this dispatch

### Wire contract tightened

- `978107b` — added explicit `long-rest-prepare-authorized` envelope carrying exact Host-approved preflight.
- `919b423` — prepare-authorization codec tests.
- `229d44b` — `long-rest-owner-materialized` now carries the owner's fresh `CharacterSessionProjectionV1`.
- `25323d4` — projection envelope/mismatch tests.

Owner staging can no longer be ordered directly from a raw owner `accepted=true`; Host must revalidate current authority first.

### Campaign participant/global commit extracted

- `271e915` — `previewLongRestCampaignParticipant()` extracted from the local compound coordinator so connected play reuses existing Calendar/Ration/provider/master-idempotency authority independently of Character ownership.
- `f7be7ea` — added Host Campaign participant persistence.
- `3e10ccd` — authored commit/duplicate/stale Campaign participant tests.
- `f030d40`, `ab833d5` — hardened the irreversible global commit boundary: after `writeGeneration()` succeeds, runtime projection/rehydration failure is a recovery warning, never an abortable transaction result.

### Remote durable projection refresh

- `69929c5` — added refresh for an already mounted remote Character. New owner durable HP/resources/life/actions replace only durable projection data; Host initiative/status/distance/current turn economy stay Session-authoritative.

### Distributed runtime coordinator

- `2c94132` initial runtime phase port.
- `5f13ada` hardened owner prompt values, immutable owner decision, capability requirement, idempotent repeated owner-prepared/global state handling, and post-global no-abort semantics.

`connectedLongRestRuntimePort.ts` now source-models:

1. Host offer from mounted remote Character + Campaign revision;
2. owner canonical preview and accept/decline;
3. Host current-authority re-preflight;
4. explicit prepare authorization;
5. owner durable invisible Character prepare;
6. Host Campaign global commit;
7. owner materialization and rehydrate;
8. fresh owner SessionProjection;
9. Host remote durable refresh and transaction completion;
10. precommit abort;
11. same-process phase replay messages.

### Production transport integration

- `1503f97` — added dedicated `connectedLongRestSessionAdapter.ts` using a second Tauri message listener rather than rewriting the canonical connected dispatcher.
- `b2b36ef` — corrected typed canonical-wire routing.
- `1eb8674` — production main entry loads the Long Rest adapter after canonical connected-session runtime.

Production behavior:

- mutates the existing exported capability array once to advertise `connected-long-rest-v1` before Host/Join manifests are built;
- Host routes decision -> prepare authorization -> owner prepared -> Campaign global commit -> owner materialized/complete;
- Client routes offer -> owner prompt -> authorized prepare -> global commit materialization -> owner projection acknowledgement;
- precommit Host failure sends `long-rest-abort`;
- post-global failures only surface recovery warnings;
- delayed `hello` / `hello-ack` replay resends phase-appropriate messages after the canonical listener reconciles identity;
- new Session Host/Join resets old Long Rest transient records;
- `AppSnapshot.connectedLongRest.ownerPrompts` exposes owner decision/progress projection;
- adapter methods `startConnectedLongRest()` and `respondConnectedLongRest()` are source-connected.

### Distributed deterministic tests

- `e7d4816` — full runtime phase tests authored.
- `3c14aeb` — test fixture corrected to public Character resource shape.
- `868e777` — Campaign participant + distributed runtime tests added to `npm run test:campaign-rest`.

Contracts assert:

- owner prepare remains invisible;
- Host Campaign time/rations commit after owner prepare and before Character materialization;
- owner Character HP/temp HP changes only after global commit;
- fresh runtime revision returns to Host;
- Host remote HP/temp HP updates while initiative/status/economy remain Session-owned;
- remote Character never appears in Host Character library;
- stale Campaign before global commit aborts and owner stays unchanged;
- recovery messages correspond to current phase.

Exact product-code head before Rerun docs: `3c14aebff0e5983204eaae8ae552c674d726826c`.

## Validation status

**NO GREEN CLAIM.**

Observed:

- GitHub combined statuses: none at dispatch preflight;
- GitHub commit-associated workflow runs: none at dispatch preflight;
- direct canonical clone attempted again with:
  `git clone --branch work/v1-composite --depth 1 https://github.com/Kaetaeru/SimpleVTT.git /tmp/SimpleVTT`
- result: `Could not resolve host: github.com`.

Therefore no observed `tsx`, `tsc`, `npm run test:campaign-rest`, `npm run build`, `cargo test`, Tauri build, or Windows result exists for this exact implementation. Source-authored tests are validation pending.

## Remaining exact gaps

### Production UI is not yet connected

The runtime now exposes `startConnectedLongRest(...)`, `respondConnectedLongRest(...)`, and `snapshot.connectedLongRest.ownerPrompts`, but no React control calls them.

Required minimal UI:

- DM existing Campaign/Rest surface: connected remote Character offer action, reusing current optional +8h / ration selections;
- Player: exact HP/temp-HP preview plus Accept/Decline for `offered` prompt;
- accepted/prepared/committed/complete/aborted progress display with no decision mutation after submission.

Preserve the current Session layout; do not build a new full-screen workflow.

### Host process-restart durability remains unresolved

Same-process reconnect has phase replay, but Host transaction records are still transient `WeakMap` state. If Host process dies after Campaign global commit, durable Campaign `recentRequestIds` proves the transaction committed but does not contain enough preflight/preparation/owner identity to safely reconstruct and resend global commit.

Do not call V1-12 durable-complete until this boundary is either implemented with a small durable Host coordinator marker or explicitly excluded by a source-backed V1 contract decision.

### Exact-head execution evidence

Still pending.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` head.
2. Check newly observable exact-head validation. If unavailable, do not redo current source-connected work.
3. Source-review the newly added runtime/transport/Campaign code for compile contract issues before further feature work.
4. Add minimal visible UI for DM remote Rest offer and Player owner decision/progress using existing Session Campaign visual language.
5. Add UI structure/runtime tests proving visible controls call the production adapter methods and current layout is preserved.
6. Audit Host process-restart recovery against the V1 compound-transaction contract. If required, add a durable Host coordinator marker containing exact transaction/preflight/preparation/global-commit identity and recovery phase. Never compensate after Campaign global commit.
7. Then reconcile V1-12 status/evidence. Proceed to V1-13 only after distributed Long Rest is user-reachable and its required recovery boundary is source-complete.
8. Keep final comprehensive Codex audit deferred.
