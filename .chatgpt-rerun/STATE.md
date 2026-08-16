# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — open/draft, not merged
- phase checklist: `.agents/PHASE14_CHECKLIST.md`

## Preflight for this continuation

Mandatory files were read from `main` in exact order: README -> control -> STATE -> PLAN. The same run_id / sequence 1 / task_id / `continue` state was reconciled before implementation.

Actual initial state for this invocation:

- main `b71898159d650ec33e81e03ff6f38a904ec0fbec`
- work `240592cb646bfbbfe9466f94047bc1e2f544dcf9`
- PR #109 open/draft/unmerged

No verified Ready/start, participant reconnect/idempotency, or session-end gate was manually rerun from an unchanged boundary.

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserve its recorded validation/artifact history.

Phase14 preserved slices include:

- Ready/start product `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.
- explicit session end/restart product `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`, Main `31973878165`.

## Completed in this continuation

### Session-end documentation credit

The prior exact session-end evidence was credited without rerunning its green gates. Checklist head `5c6254a8882782029f31d3400614fd8414b40ccd` now marks as complete:

- visible Host live-session end control;
- transient connected participants/Ready/turn/economy/pending Resolution cleanup;
- Host ephemeral remote SessionProjection removal on end;
- fresh Host restart from a new authority context while preserving permanent Character library/canonical content;
- explicit former-client ended/offline UX without reconnect;
- P14.11 session-end/restart regression.

The owning-player “durable changes remain persisted after session end” checkbox remains deliberately unchecked because only in-memory preservation has been proven; no post-end persisted-storage rehydrate has been run yet.

### Local active-Character projection ownership repair

Exact validated product source: `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31` (`phase14: replace stale local character projection`).

Changed boundaries:

- `src/app/productionPlayRuntimeAdapter.ts`
- `tests/ui/productionLocalCharacterSwitch.test.ts`
- `.github/workflows/ui.yml`

Behavior:

1. `productionPlayRuntimeAdapter.reconcile()` now recognizes registry-backed ephemeral SessionProjection Characters and returns without applying local Character reconciliation while one is temporarily active for remote resolution.
2. `localProjectionIdByAdapter` tracks only the last local-owned production projection per adapter.
3. Switching saved local Character A -> B removes A's Scene entity, actions and economy only; if current/selected actor pointed to A they move to B.
4. Remote ephemeral SessionProjection actor, registry binding, actions and economy remain mounted and authoritative.
5. After temporary remote projection resolution context is restored, B remains the local active Character and the remote projection remains unchanged.

Focused regression `productionLocalCharacterSwitch.test.ts` exercises two saved non-fixture local Characters plus one remote ephemeral SessionProjection and proves both local replacement and remote authority preservation.

### Checklist credit

Documentation-only commit `5c6254a8882782029f31d3400614fd8414b40ccd` also credits P14.1 “Switching active Character safely removes/replaces the local player projection without corrupting other Scene entities” with exact source/gate evidence.

## Validation

At exact product source `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`:

- UI run `31974455354`, frontend job `95231722148`: **completed success**. The new `Verify Phase 14 production lifecycle and local projection ownership` step passed, all historical UI/mechanics regressions passed, and final TypeScript/build passed.
- Main Playable run `31974455339`, playable-contract job `95231722256`: **completed success**. Full UI/rules/TypeScript/build, Phase11 offline playable, Phase12 connected authority, and Phase13 arbitrary SessionProjection all passed.
- Windows subjobs are not treated as human/final release acceptance evidence here.

Current work head after documentation credit: `5c6254a8882782029f31d3400614fd8414b40ccd`.

## Architecture boundaries preserved

- Remote SessionProjection registry is the discriminator for ephemeral Host/session actors; local cleanup never guesses from ids or fixture names.
- Host/session projection authority remains untouched by local active-Character switching.
- Owning-client permanent Character data remains separate from transient SessionProjection state.
- No tactical map/grid/path/LOS scope and no new fixture fallback were introduced.

## Housekeeping

Four accidental refs were created during Git-data commit preparation: `tmp/noop-do-not-use`, `tmp/noop-do-not-use-2`, `tmp/noop-do-not-use-3`, `tmp/noop-do-not-use-4`. They point to the old work head, are outside `agent/**`, do not affect PR #109 or product CI, and must not be used. The connected GitHub connector exposes no delete-ref action and `gh` is not installed in this environment, so they could not be removed here. This is repository housekeeping, not a product blocker.

## Known remaining work

1. Final unchecked P14.8 Participant lifecycle safety item: incompatible/invalid entry must be proven not to leave a ghost participant, peer mapping, ledger mutation, or stale projection.
2. Owning-player durable-after-end storage persistence still lacks an end -> fresh persisted rehydrate proof.
3. Many P14.1–P14.7 feature/checklist items remain uncredited or incomplete despite some underlying implementation existing; reconcile only with concrete evidence.
4. Windows two-instance human acceptance and final exact-head release artifact verification remain future work.
5. PR #109 remains draft/unmerged. No merge is authorized.

## Next Exact Action

1. Inspect the existing Host `hello` compatibility/SessionProjection rejection path and add a focused regression for both incompatible manifest and invalid SessionProjection. Assert no participant, no `peerParticipants`/`peerManifests` entry, no projection registry mount, and no Host ledger event/cursor advancement. Patch product source only if the regression exposes a real mutation-before-rejection bug.
2. Run Phase12 first. If the work is test-only and existing behavior passes, do not rerun UI/Main. If production source changes, run the affected UI/Main boundary once.
3. Then build the owner persistent-storage end/restart proof using the existing owning-client write-back/persistence harness: Host-confirmed durable mutation -> explicit session end -> fresh adapter/library rehydrate -> durable change present, transient session state absent.
4. Credit only evidence-backed checklist items after validation.

## Dispatch recommendation

`continue`
