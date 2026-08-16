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

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`, Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable Phase14 slices remain preserved unless their boundary changes. Ready/start remains closed at product source `bd1077b9bc61b86c2c0370543a16496c72f840c2` and checklist-only credit `56ef07b85e805368b1a9a61863c68683c3409208`. Exact-peer disconnect/live late-join/Host reconnect is preserved at `84d1d39135c08a2094783fb336a606f294b1cf58` with Phase12 `31972318100`, UI `31972318109`, Main `31972318188` success.

## Preflight for this continuation

Mandatory files were read from `main` in exact order: README -> control -> STATE -> PLAN. run_id / sequence / task / `continue` reconciled.

Actual initial state:

- main `56b3a73c6927af2390cfed8bef58376072602c72`
- work `84d1d39135c08a2094783fb336a606f294b1cf58`
- PR #109 open/draft/unmerged

No verified Ready/start or previous exact-disconnect/live-late-join work was manually repeated.

## Completed in this continuation

**Exact work head before coordination writes:** `cf520d35acd1e21a0247fdeb2d3664ae8a334345`.

### Client reconnect from accepted cursor

`7676f0390f8f86d9484a5da9661b6218bd82fdd1` adds a focused production client regression that exercises the existing reconnect timer rather than bypassing it:

- initial connected hello uses cursor 0;
- client applies Host event sequence 1;
- transport disconnect schedules reconnect and reports cursor 1;
- reconnect reuses the same Host address and sends hello with `knownEventCursor:1`;
- hello-ack catch-up sequence 2 applies once;
- replaying the same hello-ack leaves replica cursor at 2, does not duplicate Activity mutation, and leaves exactly one local participant record.

`9436d8e8873eab81d9eddf53d501325413f2d090` added this test to canonical Phase12. The new authority step passed before later source changes.

### Replayed hello idempotency

Inspection then found the remaining lifecycle hole: same accepted peer/participant hello replay could create an extra semantic `participant connected` Host ledger event.

- `1d4112b53f99252cdb576f992a31118c62643e72` adds `connectedParticipantIdempotencyAdapter.ts`. It only deduplicates Host participant events when the latest authoritative state for the same participant has identical participant name, Character name, connection state and Ready value. It does not replace ActionRequest/event idempotency logic.
- `00f353b7cd3002fd528d3fcbd3f1ce64d2db0703` composes that adapter in production `src/main.tsx`.
- `f36121fbcbd5933e1126bb2abedaa9cc8cc42f90` adds a focused same-peer hello replay regression: current-cursor replay does not advance Host history and returns no event; stale-cursor replay returns the existing event only and still does not advance Host history.
- `f7ec37c95b38a3ae8328d3aaddc0445beb74c383` adds the test to canonical Phase12.
- Main `31972970460` at the intermediate `f7ec...` head failed only TypeScript narrowing in the new adapter (`candidate.payload.participantId` inside a callback). No product authority behavior failed.
- `cf520d35acd1e21a0247fdeb2d3664ae8a334345` fixes that compile-only issue by capturing the narrowed participant payload before the callback.

## Exact validation at `cf520d35...`

- Phase12 `31973034389` connected-protocol: **success**. New client reconnect and hello replay tests, existing connected authority/lifecycle tests, Phase11 preservation and production frontend build all passed.
- UI `31973034337`: **success**, including Phase14 Host lifecycle, mechanics regressions, TypeScript and production build.
- Main Playable `31973034347`: playable-contract **success** — full UI/rules/TypeScript/build, Phase11, Phase12 core authority and Phase13 arbitrary Character SessionProjection all passed.
- Windows sub-jobs may continue independently and are not human/final release acceptance evidence for this checkpoint.

## Participant lifecycle evidence status

The four P14.8 participant lifecycle behaviors are now evidence-backed:

1. late join policy is explicit: preparation join accepted through the existing production lobby path, genuinely new live join rejected before projection/ledger mutation;
2. exact transport disconnect marks only the mapped participant unavailable/Ready false while preserving Host SessionProjection/runtime state;
3. reconnect rebinds the accepted participant/Character, resumes from the client replica's last accepted cursor, applies ordered catch-up once, and does not duplicate participant/projection/session mutation;
4. duplicate/replayed hello is now semantically idempotent, while existing request/event replay protections remain preserved in the same canonical connected suite.

`.agents/PHASE14_CHECKLIST.md` was not bulk-rewritten in this execution. The connected GitHub write action replaces whole files and the checklist is a long completion record; a documentation-only bulk rewrite was deliberately avoided after validation. This is not a product blocker. The next invocation should safely mark exactly those four boxes `[x]` with the evidence above without rerunning the gates.

## Architecture boundaries preserved

- Host ledger/shared-session authority preserved.
- SessionProjection Host runtime remains authoritative across reconnect.
- exact peer identity continues to come from Tauri transport, never peer-count inference.
- client reconnect uses the existing replica event cursor and existing hello-ack/event-batch apply path.
- owning-client durable Character ownership is unchanged.
- no tactical map/grid/path/LOS scope and no fixture fallback added.

## Known remaining work

1. Documentation-only: credit the four now-proven P14.8 participant lifecycle checklist boxes.
2. Explicit live session end notification/cleanup and former-client ended/offline state, then fresh Host restart.
3. Known stale prior local-owned projection when switching two non-fixture local Characters; repair must preserve remote ephemeral SessionProjection actors.
4. Additional P14.1–P14.7 product/checklist areas remain incomplete.
5. Windows two-instance human acceptance/final release artifact verification remains future work.
6. PR #109 remains draft and unmerged; no merge is authorized.

## Next Exact Action

1. Safely update only the four P14.8 `Participant lifecycle` boxes in `.agents/PHASE14_CHECKLIST.md` to `[x]` with `cf520d35...` / Phase12 `31973034389` / UI `31973034337` / Main `31973034347` evidence. This is documentation-only; do not rerun lifecycle gates.
2. Immediately continue explicit connected session end/restart: define the Host-to-client end notification on the existing wire model, ensure clients clear transient live/lobby authority after end, preserve owner durable Character data, clear ephemeral SessionProjection state, and start a fresh Host authority context without stale participants/cursors.
3. Add focused end/client cleanup/restart regressions and run Phase12 first. Run UI/Main only if production source boundaries change.
4. After end/restart, fix stale previous local-owned projection when switching active non-fixture Characters without deleting remote ephemeral SessionProjection actors.

## Dispatch recommendation

`continue`
