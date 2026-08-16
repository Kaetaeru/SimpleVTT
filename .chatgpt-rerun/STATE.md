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

Mandatory files were read from `main` in exact order: README -> control -> STATE -> PLAN. The preserved run_id / sequence 1 / task_id / `continue` state matched.

Actual initial state for this invocation:

- main `84b6ab2fd7c8621faa9890ab39b99a3422ba1748`
- work `5c6254a8882782029f31d3400614fd8414b40ccd`
- PR #109 open/draft/unmerged

No previously green Ready/start, reconnect/idempotency, session-end, or local projection ownership gate was manually repeated from an unchanged product boundary.

## Preserved validated product boundaries

- Phase13 complete baseline: `7c9440970753a370fec7830cfa691832552e1d05` with its recorded validation/artifact history.
- Ready/start: `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.
- explicit session end/restart: product `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`, Main `31973878165`.
- local active-Character projection ownership: product `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`, UI `31974455354`, Main `31974455339`.

No product source changed in this invocation.

## Completed in this continuation

### P14.8 incompatible/invalid entry ghost-state safety

`a745ac7b739655fbd02aec5fc3f50f1b95952303` added focused Host hello regressions to `tests/ui/productionParticipantLifecycle.test.ts`:

- incompatible protocol manifest rejection;
- invalid/mismatched SessionProjection rejection;
- both assert unchanged Host ledger cursor, no participant roster entry, no `peerParticipants`/`peerManifests`, no projection registry mount, and no rejected Character Scene/actions/economy state.

Phase12 `31974876763` initially failed one new test before the hello path ran. Root cause was test fixture construction: the regression cloned the legacy mock Character class name `전사`, which cannot be resolved as a canonical generated content identity by `buildCharacterSessionProjectionV1`. The incompatible-manifest regression passed, and no product mutation failure was observed.

`7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d` fixed only the fixture by selecting the Host catalog's actual class/species/background identities, building a valid non-fixture projection, and then intentionally mismatching its Character id from the manifest.

Validation:

- Phase12 `31974996616`, connected-protocol job `95233005867`: **completed success**. New rejection safety + existing connected authority + Phase11 preservation + production frontend gate all green.

Result: the final P14.8 Participant lifecycle checkbox, “Incompatible or invalid participant entry does not leave a ghost participant or stale projection behind,” is evidence-backed.

### P14.8 owning-client durable state survives explicit session end + fresh storage rehydrate

`b20ecf18015cec15ad3eb26aba5674e5c91013cb` extends `tests/ui/productionSessionEnd.test.ts` using existing connected and Character-library persistence boundaries only.

The new regression:

1. creates a saved non-fixture owning Client backed by `MemoryCharacterLibraryStore`;
2. enters production client lobby and initializes its connected replica;
3. receives a Host-authoritative `event-batch` with a character-durable resource `ResolutionEvent`;
4. verifies Character library storage revision advances before the client event cursor reaches 1;
5. receives explicit `session-ended` and becomes offline;
6. creates a fresh `MockAdapter` using the same Character library store;
7. verifies the same non-fixture active Character id and committed resource value rehydrate from storage while session lifecycle remains offline.

Validation at `b20ecf18015cec15ad3eb26aba5674e5c91013cb`:

- Phase12 `31975132450`, connected-protocol job `95233321482`: **completed success**. New persistence/end regression, existing connected authority, Phase11 preservation, and production frontend gate all green.
- Main Playable `31975132458`, playable-contract job `95233333094`: **completed success**. Full UI/rules/TypeScript/build, Phase11, Phase12, and Phase13 all green.
- Persistence `31975132446`, application-contract job `95233321444`: **completed success**, including production build. The separate Tauri storage job was still running at checkpoint and is not required evidence for this test-only slice.
- Windows jobs are not treated as human/final release acceptance evidence here.

Result: the P14.8 owning-player durable-after-end storage persistence checkbox is evidence-backed.

### Checklist credit

Documentation-only work head `e0f568cf71cfd05f490187fd206a5b0ef237f0d4` updates `.agents/PHASE14_CHECKLIST.md` and credits exactly the two newly proven P14.8 statements:

- incompatible/invalid participant entry leaves no ghost participant or stale projection;
- owning-player durable Character changes already committed through authoritative events remain persisted after explicit session end.

No additional P14.1–P14.9 boxes were inferred from these tests.

## Current actual state before coordination writes

- canonical `main`: `84b6ab2fd7c8621faa9890ab39b99a3422ba1748`
- work branch: `e0f568cf71cfd05f490187fd206a5b0ef237f0d4`
- latest test head: `b20ecf18015cec15ad3eb26aba5674e5c91013cb`
- latest validated product source remains `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31` for local projection ownership; connected/session-end product boundaries are unchanged from their preserved commits.
- PR #109: open, draft, merged=false, head `e0f568cf71cfd05f490187fd206a5b0ef237f0d4`
- no merge performed or authorized.

## Architecture boundaries preserved

- Host hello rejects incompatible/invalid entry before accepted peer/participant ledger mutation.
- SessionProjection remains ephemeral Host/session authority and is not written into the Host permanent Character library.
- Host-confirmed character-durable events are persisted by the owning Client before its connected event cursor advances.
- explicit session end clears session-only authority without reverting already committed owning-client Character library state.
- fresh storage rehydrate restores Character durability but not connected session lifecycle.
- no fixture fallback, hard-coded product Character id, tactical map/grid/path/LOS scope, or duplicate persistence source was introduced.

## Housekeeping

Accidental refs `tmp/noop-do-not-use`, `tmp/noop-do-not-use-2`, `tmp/noop-do-not-use-3`, and `tmp/noop-do-not-use-4` remain outside `agent/**`, point to the old work head, and do not affect PR #109 or product CI. The current connector exposes no delete-ref operation and `gh` is unavailable here. Do not use them; remove later through a delete-ref-capable path. This is not a product blocker.

## Known remaining work

1. Many P14.1–P14.7 product/checklist items remain uncredited or incomplete; some underlying behavior exists but must be reconciled against concrete evidence rather than inferred.
2. P14.8 Player Character selection/join/lobby, Error UX, Handshake/projection, and Remote actions sections still contain unchecked statements even though some prior tests may already prove subsets; audit before writing new code.
3. P14.9 full persistence/restart ownership gate remains broader than the single resource/end proof: newly created Character persistence, full active identity/restart/play re-entry, HP/item durability and session-only non-persistence still need product-realistic coverage.
4. P14.10 UX/accessibility and P14.11 fresh Character product-realistic integration remain incomplete.
5. Windows two-instance human acceptance and final exact-head release artifact verification remain future work.
6. PR #109 remains draft/unmerged; no merge is authorized.

## Next Exact Action

1. Audit existing exact evidence for P14.8 Player Character selection/join/lobby and visible error UX. Credit only statements already directly proven; do not rerun their unchanged gates.
2. Then create the next focused P14.1/P14.11 product-realistic regression: author/finalize a brand-new non-fixture Character through the existing Character Creation + Character library persistence path, enter local production play, verify the new id is the live Scene actor with derived actions, create a fresh adapter from persisted storage, and prove the same Character can re-enter local play without reference fixture fallback.
3. Start test-first. Patch product source only if create/save -> play -> restart exposes a real composition/reconciliation gap.
4. Run only the affected gates once. Preserve closed connected/session-end gates if their product source boundary is untouched.

## Dispatch recommendation

`continue`
