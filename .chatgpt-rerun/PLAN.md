# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Tracking issue: #108
- Draft PR: #109 — open/draft, unmerged
- Phase checklist: `.agents/PHASE14_CHECKLIST.md`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; retain its recorded regression and Windows artifact evidence.

Do not repeat evidence-backed Phase14 slices unless their relevant source boundary changes:

- Ready/start: product `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.
- explicit session end/restart: product `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`, Main `31973878165`; checklist credit is now recorded on the work branch. Owning-player durable-after-end **storage persistence** remains uncredited until a real rehydrate/restart proof exists.

## Current validated slice — local Character projection ownership

Current work head is checklist-only `5c6254a8882782029f31d3400614fd8414b40ccd`; exact validated product source is its parent `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`.

`7f4486ab...` fixes the stale previous local-owned actor left behind when switching between saved non-fixture Characters:

1. `productionPlayRuntimeAdapter.reconcile()` now imports `isEphemeralSessionProjectionCharacter` and refuses to treat a temporary remote SessionProjection resolution context as the local production Character.
2. A per-adapter `WeakMap` tracks only the last local-owned projected Character id.
3. On local A -> B switch, only A's Scene entity/actions/economy are removed; current/selected actor references pointing to A move to B.
4. Remote ephemeral SessionProjection actors, registry bindings, actions and economy are preserved.
5. `productionLocalCharacterSwitch.test.ts` proves local A -> B cleanup with a simultaneously mounted remote projection and also proves a temporary remote resolution context does not overwrite remote authoritative action state or corrupt local ownership tracking.
6. UI canonical workflow now runs that regression in the Phase14 production lifecycle step.

### Exact validation

At product source `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`:

- UI `31974455354`, frontend job `95231722148`: **success**. The new local projection ownership regression passed; all historical UI mechanics steps and final TypeScript/build passed.
- Main Playable `31974455339`, playable-contract job `95231722256`: **success**. Full UI/rules/TypeScript/build, Phase11, Phase12 and Phase13 passed.
- Windows subjobs are not used as human/final release acceptance evidence for this slice.

`5c6254a8882782029f31d3400614fd8414b40ccd` is documentation-only and credits:

- P14.1 safe active-Character local projection replacement;
- P14.8 visible explicit session end, transient cleanup, Host ephemeral projection removal, fresh Host restart;
- former-client explicit ended/offline UX;
- P14.11 session-end/restart automated regression.

The P14.8 owning-player durable-after-end persistence box remains intentionally open.

## Housekeeping note

During Git-data commit preparation, four accidental refs were created: `tmp/noop-do-not-use`, `tmp/noop-do-not-use-2`, `tmp/noop-do-not-use-3`, `tmp/noop-do-not-use-4`. They point to the old work head, are outside `agent/**`, do not affect PR #109 or product CI, and must not be used. The connected GitHub tool exposes no delete-ref action and `gh` is not installed in this environment; delete these refs when a delete-ref-capable GitHub path is available. This is not a product blocker.

## Next Exact Action

1. Close the final unchecked P14.8 Participant lifecycle safety item: add a focused Host hello regression proving both an incompatible manifest and an invalid SessionProjection leave no participant, peer mapping, Host projection registry entry, or synthetic ledger event/ghost state. Inspect existing handshake behavior first and patch only if the regression exposes a real gap.
2. Run canonical Phase12 first. If this is test-only and existing behavior passes, do not rerun UI/Main. If production source changes, run the affected UI/Main boundary once.
3. Then prove owning-player durable-after-end **storage persistence**: apply a Host-confirmed character-durable mutation on the owning client, end the session explicitly, rehydrate a fresh adapter/library from persisted storage, and verify the committed change survives while session-only state does not. Reuse the existing persistence/write-back harness rather than inventing a second source of truth.
4. Credit only evidence-backed checklist items after those gates pass.
5. Continue remaining P14.1–P14.7 product/checklist reconciliation, followed later by Windows two-instance human acceptance and final exact-head artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.
