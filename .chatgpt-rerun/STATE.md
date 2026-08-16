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

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserve its recorded validation/artifact history. Ready/start, exact-peer participant lifecycle, and client reconnect/replay idempotency remain closed at their recorded exact heads and must not be manually repeated unless their relevant boundary changes.

## Preflight for this continuation

Mandatory files were read from `main` in exact order: README -> control -> STATE -> PLAN. run_id / sequence / task / `continue` reconciled.

Initial actual state:

- main `7449e294259f2e98ccfad04e10e620cb6557177a`
- work `cf520d35acd1e21a0247fdeb2d3664ae8a334345`
- PR #109 open/draft/unmerged

## Completed in this continuation

**Exact work head before coordination writes:** `240592cb646bfbbfe9466f94047bc1e2f544dcf9`.

### Participant lifecycle documentation credit

`8bfaf4dd3a35e2a9da81022d4a7c91bdbaabd9b3` safely updated the full checklist from its exact blob and marked only the four P14.8 participant lifecycle items previously proven at `cf520d35...`: late join policy, disconnect preservation, cursor reconnect without duplication, and duplicate/replayed traffic idempotency. The invalid/ghost participant checkbox remains open.

### Explicit session end / restart implementation

- `6b0d78868dab5383f731d0e82c28eccc88369f40`: adds `session-ended` wire envelope and validation.
- `22df2903091f5caef2b3337c4cebee9d61c681c5`: adds `session-end-v1`, shared transient cleanup and client end handling. Client connected mode/sessionId/replica/reconnect timer is cleared before transport stop, so the ensuing disconnect cannot schedule reconnect.
- Transient cleanup resets connected authority, participants/Ready, session mode, round/current turn, economy and pending Resolution while preserving permanent Character/resource/item/catalog state. Production reconciliation rematerializes only a fresh local active-Character economy when needed.
- `ca5193b4d94989dd511bf3d3772e48729779e110`: Host broadcasts `session-ended` before transport teardown, then unmounts reconstructed remote SessionProjection actors and resets connected authority.
- `0082f8d8aaafd4a751cee47abba739005142a751`: visible live Host control says `세션 종료`; preparation retains `Host 중지`.
- `f9d54edc20d087922ce808ee41225f7ccf377318`: session-end wire roundtrip/rejection tests.
- `4fc799602d88247c2729a3ec2628efaa068454f0`, `6e3247ab079473623fdff4b920c79395a35d7c73`: focused Host notify-before-stop/cleanup/fresh restart, client ended/no-reconnect, projection removal, permanent resource preservation, and visible-control tests.
- `a03f1b585b4fa9663e2a1e4aaa8c55613ffb620a`: canonical Phase12 includes `productionSessionEnd.test.ts`.
- `c39df9d01821b96a3b4f06b28016e8f9956a802e`: Main Playable includes the session-end regression and connected walkthrough end/restart step.
- Phase12 `31973697477` initially failed only because the new test asserted `economyByActor={}`. Actual product reconciliation correctly created a fresh default economy for the active local Character and removed stale remote/turn economy.
- `240592cb646bfbbfe9466f94047bc1e2f544dcf9`: corrects that test expectation; no product behavior was weakened.

## Validation

At exact work head `240592cb646bfbbfe9466f94047bc1e2f544dcf9`:

- Phase12 `31973878162` connected-protocol: **success**. Explicit session-end regressions, existing Ready/participant/reconnect authority, Phase11 preservation and production frontend build passed.
- Main Playable `31973878165` playable-contract: **success**. Full UI/rules/TypeScript/build, Phase11, Phase12 including `productionSessionEnd.test.ts`, and Phase13 passed.
- UI `31973684409`: **success** at the identical product source boundary before later test/workflow-only commits; TypeScript/build and existing UI regressions passed.
- Windows jobs were still separate/in progress and are not used as human/final release acceptance evidence here.

## Evidence-backed session-end status

The following P14.8/P14.11 behaviors are now directly supported and may be credited documentation-only next invocation without rerunning gates:

1. visible Host live-session end control;
2. Host notifies clients before transport teardown;
3. Host/client transient participants, Ready, cursor/replica, turn/economy and pending Resolution state do not leak into a fresh session;
4. Host ephemeral reconstructed SessionProjection actors are removed;
5. former Client receives an explicit ended/offline state and does not reconnect;
6. fresh Host restart gets a new session authority context while permanent local Character state remains intact;
7. canonical Phase12/Main contain the session end/restart regression.

Do **not** credit the checklist statement that owning-player durable changes “remain persisted after session end” yet. Current regression proves in-memory permanent Character state is preserved through end/restart authority cleanup, but does not perform an owner storage restart after ending the session.

## Architecture boundaries preserved

- Host ledger/shared-session authority preserved.
- SessionProjection remains ephemeral Host session authority and is explicitly removed on end.
- owning-client permanent Character ownership remains unchanged.
- normal disconnect/reconnect still uses cursor replay; explicit Host end is distinguished by `session-ended`.
- no tactical map/grid/path/LOS scope and no fixture fallback added.

## Known remaining work

1. Documentation-only session-end checklist credits listed above.
2. Stale previous local-owned projection when switching between two saved non-fixture local Characters; repair must not delete remote ephemeral SessionProjection actors.
3. Owner persistent-storage end/restart proof remains needed before crediting durable-after-end persistence.
4. Other P14.1–P14.7 checklist/product areas remain incomplete.
5. Windows two-instance human acceptance/final exact-head release artifact remains later.
6. PR #109 remains draft and unmerged; no merge authorized.

## Next Exact Action

1. Safely mark only the evidence-backed P14.8 session-end/restart + former-client ended UX + P14.11 session-end regression boxes; leave owner durable-after-end persistence unchecked. Documentation-only, no gate rerun.
2. Inspect `productionPlayRuntimeAdapter` and projection registry ownership around active Character switching.
3. Reproduce two saved non-fixture local Characters plus one remote ephemeral SessionProjection; switch local active Character and prove only the previous local-owned actor/projection is removed/replaced.
4. Add a focused regression preserving the remote projected actor/registry binding; run the narrow relevant production/UI gate, then Main only if product source changes.

## Dispatch recommendation

`continue`
