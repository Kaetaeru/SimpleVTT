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

## Preserved evidence — do not repeat unchanged boundaries

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; retain its recorded validation/artifact history.

Phase14 preserved slices:

- Ready/start: product `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.
- explicit session end/restart product: `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`, Main `31973878165`.
- local active-Character projection ownership product: `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`, UI `31974455354`, Main `31974455339`.

No product source changed in the latest continuation. Current work head is documentation-only `e0f568cf71cfd05f490187fd206a5b0ef237f0d4`; the latest test head is its parent `b20ecf18015cec15ad3eb26aba5674e5c91013cb`.

## Latest validated slice — rejected participant entry safety

Test-only work:

1. `a745ac7b739655fbd02aec5fc3f50f1b95952303` added explicit regressions for incompatible manifest and invalid SessionProjection entry, asserting no Host ledger cursor change, no participant, no `peerParticipants`/`peerManifests`, no projection registry mount, and no Scene/actions/economy ghost.
2. Phase12 `31974876763` failed only in test fixture construction: the invalid-projection regression attempted to build a projection from the legacy mock class name `전사`, which is not a canonical generated catalog identity. The incompatible-manifest regression itself passed. This was not a product behavior failure.
3. `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d` rebuilt that unknown Character from the Host catalog's actual class/species/background identities, then intentionally mismatched the projection Character id.
4. Phase12 `31974996616`, connected-protocol job `95233005867`: **completed success** — rejection safety, existing connected authority, Phase11 preservation, and production frontend gate all green.

The final P14.8 participant lifecycle checkbox is now credited on the checklist.

## Latest validated slice — owning-client durable state across explicit session end

Test-only `b20ecf18015cec15ad3eb26aba5674e5c91013cb` extends `productionSessionEnd.test.ts` with the actual connected/persistence path:

1. create a saved non-fixture owning Client backed by `MemoryCharacterLibraryStore`;
2. enter the production client lobby and initialize the connected replica;
3. receive a Host-authoritative `event-batch` containing a character-durable resource `ResolutionEvent`;
4. require Character library generation commit before client event cursor advances;
5. receive explicit `session-ended` and become offline;
6. create a fresh adapter against the same store and rehydrate the same non-fixture Character id and committed resource value;
7. verify session lifecycle remains offline rather than being persisted as Character durability.

Validation at exact test head `b20ecf18015cec15ad3eb26aba5674e5c91013cb`:

- Phase12 `31975132450`, connected-protocol job `95233321482`: **completed success** — new storage rehydrate proof, existing connected authority, Phase11 preservation, and production frontend gate all green.
- Main Playable `31975132458`, playable-contract job `95233333094`: **completed success** — full UI/rules/TypeScript/build + Phase11 + Phase12 + Phase13 green.
- Persistence `31975132446` application-contract job `95233321444`: **completed success**, including production build. Its separate Tauri storage job was still running when this checkpoint was prepared and is not needed as evidence for this test-only slice.
- Windows jobs are not human/final release acceptance evidence here.

Checklist-only `e0f568cf71cfd05f490187fd206a5b0ef237f0d4` credits exactly:

- P14.8 incompatible/invalid participant entry leaves no ghost participant or stale projection;
- P14.8 owning-player durable Character changes already committed through authoritative events remain persisted after session end.

## Architecture boundaries preserved

- Host ledger/peer/session authority is unchanged; the latest connected work is regression coverage only.
- SessionProjection remains ephemeral Host session authority.
- owning-client Character library write-back remains the only permanent storage path for remote player Characters.
- local active-Character cleanup still distinguishes registry-backed remote SessionProjection actors from local-owned projections.
- no fixture fallback, hard-coded production Character id, tactical map/grid/path/LOS expansion, or second durability source was introduced.

## Housekeeping note

Accidental refs `tmp/noop-do-not-use`, `tmp/noop-do-not-use-2`, `tmp/noop-do-not-use-3`, and `tmp/noop-do-not-use-4` remain outside `agent/**` and do not affect PR #109 or product CI. The connected connector exposes no delete-ref operation and `gh` is unavailable in this environment. Do not use these refs; remove them later through a delete-ref-capable path. This is not a product blocker.

## Next Exact Action

1. Do **not** rerun the now-closed Ready/start, participant lifecycle, session-end, local projection ownership, or durable-after-end gates unless their relevant product boundary changes.
2. Audit existing exact evidence for P14.8 Player Character selection/join/lobby and visible error UX. Credit an item only when an existing test actually proves the exact statement; do not add tests merely to restate already-proven behavior.
3. Then build the next product-realistic integration slice around P14.1/P14.11: author/finalize a brand-new non-fixture Character id through the existing creation + Character library persistence path, enter local production play, verify Scene actor materialization and derived `actionsByActor`, persist/restart a fresh adapter, and prove the same Character re-enters play without reference fixture fallback.
4. Start test-first. Patch product source only if that fresh Character create/save -> play -> restart regression exposes a real reconciliation/composition gap.
5. Run only the gates affected by that source boundary: focused test first; Persistence/UI/Phase11/Main once if product or persistence composition changes. Preserve existing connected gates if untouched.
6. After P14.1 baseline is concrete, continue Skills/Actions/Inventory/Spells and DM/live-session product-realistic coverage, then Windows two-instance human acceptance/final exact-head artifact verification.
7. PR #109 remains draft/unmerged. No merge is authorized.
