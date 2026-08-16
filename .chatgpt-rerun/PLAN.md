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

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05` with its recorded Contract/Rules/Persistence/UI/Phase11/Phase12/Phase13 gates and Windows artifact SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Do not repeat evidence-backed Phase14 slices unless their relevant source boundary changes:

- Ready/start: product `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.

## Participant lifecycle checklist credit

`8bfaf4dd3a35e2a9da81022d4a7c91bdbaabd9b3` safely updated `.agents/PHASE14_CHECKLIST.md` and credited exactly the four verified P14.8 participant lifecycle boxes: late-join policy, exact disconnect preservation, cursor reconnect without duplication, and replay idempotency. No CI rerun was required for that documentation-only commit.

## Explicit connected session end / restart

Current exact work head: `240592cb646bfbbfe9466f94047bc1e2f544dcf9`.

Implemented on the existing connected authority model:

1. `6b0d78868dab5383f731d0e82c28eccc88369f40` adds typed `session-ended { sessionId, reason }` wire validation.
2. `22df2903091f5caef2b3337c4cebee9d61c681c5` adds `session-end-v1`, client authoritative end handling, and shared transient cleanup. Client state/replica/reconnect timer is reset before transport stop, preventing normal Host end from being misread as a reconnectable network loss.
3. Shared cleanup resets connected participants/cursors/Ready/session mode/round/current turn/economy/pending Resolution while preserving permanent Character/resource/item/catalog state. Production reconciliation may immediately recreate only the active local Character's fresh default economy.
4. `ca5193b4d94989dd511bf3d3772e48729779e110` makes Host `stopSession()` broadcast `session-ended` before transport teardown, then unmount remote SessionProjection actors and reset connected authority.
5. `0082f8d8aaafd4a751cee47abba739005142a751` labels the visible live Host control `세션 종료` while retaining `Host 중지` for preparation.
6. `f9d54edc20d087922ce808ee41225f7ccf377318`, `4fc799602d88247c2729a3ec2628efaa068454f0`, and `6e3247ab079473623fdff4b920c79395a35d7c73` add wire, Host/client cleanup/restart, and visible-control regressions.
7. `a03f1b585b4fa9663e2a1e4aaa8c55613ffb620a` gates session end in canonical Phase12; `c39df9d01821b96a3b4f06b28016e8f9956a802e` also gates it in Main Playable and updates its connected walkthrough.
8. Initial Phase12 `31973697477` failed only because the new test expected an empty economy map. Production correctly re-materialized a fresh local actor economy after cleanup. `240592cb646bfbbfe9466f94047bc1e2f544dcf9` corrects the assertion to require only that fresh local economy and no stale turn actor economy.

### Validation

At `240592cb646bfbbfe9466f94047bc1e2f544dcf9`:

- Phase12 `31973878162` connected-protocol: **success** — explicit session end regressions, existing participant/Ready/reconnect authority, Phase11 preservation, and production frontend build all green.
- Main Playable `31973878165` playable-contract: **success** — full UI/rules/TypeScript/build, Phase11, Phase12 including the explicit session-end regression, and Phase13 all green.
- UI `31973684409` completed **success** at the identical product source boundary before later test/workflow-only commits, including TypeScript/build.
- Windows artifact jobs are not human/final release acceptance evidence for this slice.

## Checklist credit discipline

On the next continuation, safely credit only the exact P14.8 session-end items now supported by this evidence: visible Host end, transient connected/turn/pending cleanup, Host ephemeral projection removal, fresh Host restart preserving permanent Character state, explicit former-client ended/offline UX, and the P14.11 session-end/restart regression. Keep the owning-player “durable changes remain persisted after session end” checkbox uncredited until an end-after-persist/restart regression proves storage durability across the boundary.

## Next Exact Action

1. Documentation-only: apply the evidence-backed session-end/restart checklist credits above without rerunning these green gates.
2. Inspect `productionPlayRuntimeAdapter` active-Character reconciliation and projection registry ownership. Reproduce switching between two saved non-fixture local Characters while a remote ephemeral SessionProjection exists.
3. Repair only the previous **local-owned** projection on active Character switch; preserve remote ephemeral SessionProjection actors/registry bindings and Host authority.
4. Add a focused local-switch regression and run only the relevant production/UI gate first, then Main if the source boundary changes.
5. Continue remaining P14.1–P14.7 reconciliation and later Windows two-instance human acceptance/final artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.
