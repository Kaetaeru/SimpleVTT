# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T08:31:00+09:00`
- Current product head before checkpoint docs: `49271f768f51bee12caa0f30a7a33f63c716bdcb`

## Human summary

Connected Long Rest remains the active V1-12 gap. This execution resumed from the existing transport/preflight/state-machine checkpoint without redoing local Long Rest, SessionProjection, reconnect, or Character/Campaign compound work.

Completed source work:

- canonical Session wire regression now covers valid/malformed `long-rest-*` envelopes;
- `connectedLongRestWire.test.ts` is included in `npm run test:campaign-rest`;
- added a real owner-side Character preparation store boundary;
- browser/test Memory preparation keeps the candidate generation invisible until materialization and enforces idempotent prepare/materialize plus precommit abort;
- Tauri now has durable `prepare`, `materialize`, and `abort` commands backed by a fsynced preparation marker under the Character library;
- Tauri preparation uses the shared Character/Campaign persistence mutex and runs compound recovery before normal work;
- after global commit, materialization writes the prepared immutable Character generation; retry after an interruption verifies the already-written generation payload before marking the preparation materialized;
- canonical owner Long Rest preparation projects Character recovery through `projectCharacterLongRest`, prepares the next Character-library generation, and does not expose it before global commit;
- focused tests were authored for visibility, idempotency, stale revision/generation rejection, abort behavior, and canonical Rest candidate materialization.

No green claim is made. GitHub exposed no exact-head statuses/workflow runs and no local TypeScript/Rust/Tauri execution result was observed. The new Rust and TS tests are source-authored only.

Remaining next gap: connect this owner preparation/materialization port to actual Host/Client `connectedSessionRuntimeAdapter` routing and the Host Campaign global commit/idempotency path. Do not copy a remote Character into the Host Character library.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
