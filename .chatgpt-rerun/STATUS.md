# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product-code checkpoint: `3c14aebff0e5983204eaae8ae552c674d726826c`

## Current result

Connected Long Rest has advanced from transport/staging primitives to a source-connected distributed runtime path:

- Host offer from a mounted remote Character revision + exact Campaign revision;
- owner canonical Rest preview and explicit decision;
- Host re-preflight before explicit prepare authorization;
- owner durable invisible Character generation prepare;
- Host Campaign-only global commit with Calendar/Ration options and durable transaction idempotency;
- owner materialization only after global commit;
- fresh owner SessionProjection returned to Host;
- Host remote durable Character projection refreshed without copying it into the Host Character library;
- Session-owned initiative/status/economy preserved during that durable refresh;
- same-process reconnect/retry replay messages for offer/decision/prepare/global commit/materialization;
- `connected-long-rest-v1` capability advertised by the production runtime adapter.

The new distributed tests are wired into `npm run test:campaign-rest`.

## Validation

**NO GREEN CLAIM.** GitHub exposed no exact-head commit statuses/workflow runs at preflight. A direct canonical clone was attempted again and failed because the execution container could not resolve `github.com`, so no `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows execution was observed.

## Still incomplete

1. No production UI currently calls `startConnectedLongRest` / `respondConnectedLongRest`. The runtime projects owner prompts into `AppSnapshot.connectedLongRest`, but DM offer controls and Player accept/decline controls remain to be added without redesigning the Session UI.
2. Same-process reconnect is represented, but Host distributed transaction records are still transient `WeakMap` state. A Host process restart after the Campaign global commit cannot yet reconstruct the exact preflight/preparation relationship from durable state alone. This must be solved or explicitly bounded by the V1 recovery contract before V1-12 can be DONE.
3. Exact-head execution evidence remains pending.

`STATUS.md` is human-facing only. Reconciliation authority remains README -> control -> STATE -> PLAN.
