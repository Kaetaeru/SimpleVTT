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
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` success and Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable Phase14 evidence unless source boundary changes:

- PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635`.
- Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715`.
- saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226`.
- fresh non-fixture production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422`.
- repaired pre-Ready core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862`: UI `31970228863`/`31970230351`, Contract `31970230345`, Phase11 `31970230344`, Phase12 `31970230336`, Main `31970230364` success.

## Preflight and actual state for this continuation

The required files were read from `main` in the mandatory order:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

run_id / sequence / task_id / `continue` reconciled successfully.

Initial actual state:

- `main=743e72605ae198b99dc31382b9b535eee9d17379`
- work branch=`04ceba160ac84052866f5b7fc91e4c69ab1db527`
- PR #109 open/draft/unmerged
- exact-head Main `31971251262` playable-contract at `04ceba...` was fetched and confirmed success: full UI/build, Phase11, Phase12 authority and Phase13 SessionProjection all passed. Its Windows job was separate and not used as completion evidence.

## Completed in this continuation — Ready/start safety closure

Current work branch head after checklist-only credit: `56ef07b85e805368b1a9a61863c68683c3409208`.
Validated product source boundary: `bd1077b9bc61b86c2c0370543a16496c72f840c2`.

### Host peer-loss stale-Ready safety

`c6d766ef452d31223617978f5421c8ed6563b3ec` changed `productionSessionLifecycleAdapter.ts` only at the production lifecycle boundary:

- installs one reusable Host `SessionTransportStatus` observer per adapter;
- tracks aggregate Host `peerCount` without inventing a disconnected peer identity;
- before session start, a peer-count decrease resets every currently Ready player to `ready:false`;
- each reset is committed through the existing Host `participant` ledger event and normal event-batch broadcast;
- peer/manifests stay bound, so remaining peers may Ready again while a missing peer remains unable to Ready and therefore still blocks Start until reconnect/re-handshake;
- stop/restart resets the observer's peer-count baseline without duplicating listeners;
- no duplicate mode/participant authority channel was added.

This is intentionally conservative because the current frontend transport status exposes aggregate peer count, not the departing peer id.

### Direct Freeform prepared-start regression

`2564bca3904072d552ef470257ca05fc92e9f794` added `tests/ui/productionReadyStartSafety.test.ts`:

- proves `peerCount 1 -> 0` resets stale Ready through authoritative participant events and re-blocks Start;
- directly proves a fully Ready prepared Host can call `startPreparedSession("freeform")`, enter live Freeform and publish the existing authoritative `mode-transition` event-batch.

`bd1077b9bc61b86c2c0370543a16496c72f840c2` added this focused regression to the canonical Phase12 connected authority command.

### Exact validation at `bd1077b9...`

- Phase12 `31971618571`: connected authority step success including the new safety test; Phase11 preservation success; production frontend build success.
- UI `31971618534`: production Host lifecycle focused gate, Phase09 mechanics, TypeScript and production build all success; frontend job completed success.
- Phase11 `31971618537`: production-composed offline walkthrough and full frontend gate success.
- Main Playable `31971618703`: playable-contract completed success; full UI/rules/TypeScript/build, Phase11, Phase12 connected authority and Phase13 arbitrary Character SessionProjection all success.

No verified Ready/start work was repeated unnecessarily; the earlier PlaySessionDock/Host basic lifecycle/player lobby gates were not manually rerun outside the workflow matrix.

### Checklist credit

`56ef07b85e805368b1a9a61863c68683c3409208` is checklist-only and marks exactly the six P14.8 `Ready and start lifecycle` items complete with the exact `bd1077b9...` evidence:

- player Ready/unready;
- Host readiness roster;
- Start rejection before readiness;
- prepared Freeform start;
- prepared Initiative start;
- client convergence through Host mode-transition events.

Do not reopen these boxes unless later code changes the connected readiness/start authority boundary.

## Architecture boundaries preserved

- Host ledger/shared-session authority preserved.
- compatibility handshake + SessionProjection preserved.
- event cursor/catch-up and ResolutionEvent routing preserved.
- owning-client durable Character write-back preserved.
- no tactical map/grid/path/LOS scope added.
- no fixture Character fallback added to production play.
- aggregate peer count is not treated as a fabricated peer identity.

## Known remaining work

1. P14.8 participant lifecycle: exact participant disconnect state, live late-join policy, reconnect restoration/idempotency.
2. Explicit live session end notification/cleanup and former-client ended state, then clean Host restart.
3. Known stale previous local projection when switching two non-fixture local Characters; repair must preserve remote ephemeral SessionProjection actors.
4. Additional product checklist areas remain incomplete: local/DM full flow, inventory/spell coverage, broader checklist reconciliation, human acceptance.
5. Windows two-instance human acceptance/final artifact verification remains future work. Automated Windows sub-jobs are not human acceptance.
6. PR #109 remains draft and unmerged; no merge is authorized.

## Next Exact Action

Resume P14.8 `Participant lifecycle`; do not revisit Ready/start first.

1. Inspect the Tauri connected-session backend peer lifecycle and frontend `tauriSessionTransport` event contract to determine whether the exact departing peer id already exists below aggregate `SessionTransportStatus.peerCount`.
2. If available, expose that identity with the smallest typed peer-lifecycle event; otherwise add the narrowest backend event necessary. Never infer a peer id from peer-count arithmetic.
3. Host should commit exact participant `state:"disconnected", ready:false` while preserving reconnectable authoritative SessionProjection/runtime state.
4. Define live late join explicitly: allow preparation joins; reject/defer a genuinely new participant after `sessionStarted` without mutating live turn/session state; allow a previously accepted participant to reconnect and resume from its accepted event cursor.
5. Reconnect must safely rebind peer -> participant/Character, preserve Host runtime over stale client projection, avoid duplication, and emit connected participant state. Preparation reconnect requires Ready again.
6. Add the smallest relevant Rust/transport tests plus Phase12 connected frontend regressions. Run source-relevant Tauri tests and Phase12 first; run UI/Main only if their product boundary changes.
7. After participant lifecycle is green, continue explicit session end/restart, then the local active-Character stale projection cleanup.

## Dispatch recommendation

`continue`
