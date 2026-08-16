# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Tracking issue: #108
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved evidence

Phase 13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`, and Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable Phase14 evidence remains valid unless its source boundary changes:

- PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635`.
- Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715`.
- saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226`.
- fresh non-fixture production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422`.
- repaired pre-Ready core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862` green across UI/Contract/Phase11/Phase12/Main.
- Ready/start product boundary `bd1077b9bc61b86c2c0370543a16496c72f840c2`, with Phase12 `31971618571`, UI `31971618534`, Phase11 `31971618537`, Main `31971618703` success; six P14.8 Ready/start boxes credited at checklist-only `56ef07b85e805368b1a9a61863c68683c3409208`.
- exact-peer disconnect/live late-join/Host reconnect boundary `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`; Windows Tauri transport test step also succeeded.

Do not repeat focused gates unless the relevant source boundary changes.

## Participant lifecycle — behavior closed at current product head

Current exact work head: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`.

This continuation completed the remaining client-side reconnect and replay-idempotency evidence on top of the existing Host exact-peer lifecycle implementation:

1. `7676f0390f8f86d9484a5da9661b6218bd82fdd1` adds `productionClientReconnect.test.ts`. It drives the actual reconnect timer path: initial hello at cursor 0 -> accepted event cursor 1 -> transport disconnect -> reconnect -> hello at cursor 1 -> hello-ack catch-up sequence 2. Replaying the same ack leaves replica cursor, Activity mutation and local participant cardinality unchanged.
2. `9436d8e8873eab81d9eddf53d501325413f2d090` adds that regression to canonical Phase12. Its authority step passed before the later product source change.
3. Source inspection found one remaining hello replay gap: an already-connected same peer/participant could cause another semantic `participant connected` Host event even though projection/participant cardinality remained stable.
4. `1d4112b53f99252cdb576f992a31118c62643e72` adds `connectedParticipantIdempotencyAdapter.ts`, reusing the project's runtime-adapter composition pattern. For Host `participant` events only, it compares the latest authoritative participant state by id/name/Character/state/Ready and returns the existing event when the semantic state is unchanged. ActionRequest/event idempotency remains on the existing protocol paths.
5. `00f353b7cd3002fd528d3fcbd3f1ce64d2db0703` composes the idempotency adapter in production `src/main.tsx`.
6. `f36121fbcbd5933e1126bb2abedaa9cc8cc42f90` adds `productionHelloReplayIdempotency.test.ts`, proving same accepted hello at the current cursor does not advance the Host ledger and returns no synthetic event, while a stale cursor receives only the already-existing catch-up event.
7. `f7ec37c95b38a3ae8328d3aaddc0445beb74c383` adds the hello replay regression to canonical Phase12. Main build at this intermediate head exposed only a TypeScript closure-narrowing error in the new adapter.
8. `cf520d35acd1e21a0247fdeb2d3664ae8a334345` fixes that compile-only issue by capturing the narrowed participant payload before the `.find()` callback; behavior is unchanged.

### Exact validation at `cf520d35...`

- Phase12 `31973034389`: connected-protocol completed **success**. The new client reconnect cursor/idempotency regression, replayed hello regression, existing participant lifecycle/Ready tests, Phase11 preservation and production frontend build all passed.
- UI `31973034337`: frontend completed **success**, including Phase14 Host lifecycle, mechanics regressions, TypeScript and production build.
- Main Playable `31973034347`: playable-contract completed **success** — full UI/rules/TypeScript/build, Phase11, Phase12 core authority and Phase13 arbitrary Character SessionProjection all passed.
- Windows executable/artifact jobs are separate and are not used as human acceptance or final release evidence for this slice.

The four P14.8 `Participant lifecycle` behaviors now have evidence at concrete source heads: live late-join policy, exact disconnect/unavailable state with reconnectable Host authority, reconnect from last accepted cursor without duplicate participant/projection/session mutation, and duplicate/replayed hello/action/event idempotency. The checklist file itself was intentionally not rewritten in this execution because the connector exposes whole-file replacement for that long document and a risky bulk rewrite is not warranted near checkpoint; apply the four checkbox credits as the next safe documentation edit without rerunning these gates.

## Next Exact Action

1. Safely update only the four P14.8 `Participant lifecycle` checkboxes in `.agents/PHASE14_CHECKLIST.md` to `[x]` and add concise evidence pointing to `cf520d35...`, Phase12 `31973034389`, UI `31973034337`, and Main `31973034347`. Do not rerun the verified lifecycle gates for this documentation-only credit.
2. Then implement explicit live-session end notification/cleanup. Host end must tell connected clients the session ended before transport teardown, clients must leave live/lobby authority cleanly, transient participant/session/projection state must clear, and owning-player permanent Character data must remain durable.
3. Add focused Host-end/client-ended/fresh-Host-restart regressions and run Phase12 first; run UI/Main only if production source boundaries change.
4. After connected end/restart is green, repair the known stale previous local-owned projection when switching two non-fixture local Characters while preserving remote ephemeral SessionProjection actors.
5. Continue remaining P14.1–P14.7 product/checklist reconciliation, then Windows two-instance human acceptance/final artifact verification.
6. Draft PR #109 remains open/draft. No merge is authorized or attempted.
