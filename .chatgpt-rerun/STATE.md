# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T03:41:00+09:00`

## Run continuity

This is the existing active Rerun run. Do not create a new run_id, reset sequence, or replace task_id.

Sequence 0 / `phase13-closeout-ui-dice-regression` remains completed. Preserve its exact-head evidence and artifact history recorded in PLAN and earlier STATE versions. Existing Ready/connected implementation and two-instance tooling are also not to be reimplemented merely because this watcher dispatch restarted.

## Active V1 contract

- Finish all intended V1 functionality through real production paths.
- Preserve the current visible SimpleVTT UI structure/style as the V1 baseline.
- Prefer authority/persistence/runtime wiring behind existing screens over redesign.
- Do not run a comprehensive Codex audit per slice.
- Freeze one exact pre-V1 canonical SHA only after implementation is complete, then run the comprehensive Codex audit.

## Completed in this dispatch

Selected continuation: `V1-11 Campaign product UI` lifecycle completion from the previous checkpoint.

### Preflight

- Mandatory Rerun order read: README -> control -> STATE -> PLAN.
- `control.json` reconciled as run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.
- `work/v1-composite` branch resolves and remains canonical.
- Re-read `CANONICAL_ROOT.md`, current V1 handoff, master checklist, and Campaign lifecycle design contract.
- Did not repeat previously verified Phase 13 or Ready work.

### Campaign duplicate/delete production path

Inspection found that `CampaignApplicationService.duplicateCampaign()` and `deleteCampaign()` already existed. They were therefore reused rather than reimplemented.

New work:

- `4487ebf` — added runtime lifecycle failing contract for duplicate/delete.
- `dbad5bc` — added UI ownership/destructive confirmation structure contract.
- `24957b4` — exposed `duplicateCampaign`/`deleteCampaign` through the production `MockAdapter` Campaign runtime.
  - duplicate uses the existing durable service and source revision.
  - delete uses the existing durable service.
  - delete rejects a Campaign currently captured by an active Session.
- `3c53424` — added thin `campaignLifecycleCommands.ts` UI command facade; no persistence arithmetic in presentation code.
- `d66b26b` — exposed duplicate/delete from the existing Campaign card/overlay UI without layout/navigation redesign.
  - duplicate confirmation explicitly states copied Campaign-owned continuity and excluded Player-owned Character files, installed-content ownership, Session history, and transient Session state.
  - duplicate re-names stash/DM Library/loadout namespaces through the existing service behavior.
  - delete confirmation states irreversible Campaign-owned deletion and preservation of external Character/content stores.
- `477250b` — canonical UI workflow now triggers on `work/v1-composite` and includes focused Campaign persistence/runtime/product/startup/lifecycle tests plus normal TypeScript/build gate.

### V1-11 status

Production implementation gaps identified in the prior checkpoint are now connected in code: archive confirmation, startup migration/corruption blocker UI, duplicate, and explicit delete.

Do **not** mark V1-11 DONE yet because exact-head workflow results have not been retrieved in this execution. The connector did not provide a push-run result, so no green claim is made.

Current product handoff is `.agents/V1_CURRENT_HANDOFF.md` at commit `ef9f39a`.

## Validation evidence

- Deterministic focused tests were authored with the implementation.
- Canonical UI workflow wiring now includes those tests and `npm run build`.
- Push-run success has not been observed through the available connector, so validation remains pending.
- Comprehensive Codex audit intentionally not started.

## Remaining risks

- Release checklist status text is stale relative to recent Campaign/Ready source; do not trust TODO/PARTIAL labels without source reconciliation.
- Human Windows two-instance and visual dice acceptance remains a final/pre-release evidence task, not an implementation blocker.
- Campaign duplicate currently intentionally copies Campaign-owned continuity while clearing Session history; UI states this exact scope.

## Next Exact Action

Implement `V1-12` declarative Calendar/Ration provider support without changing the established Campaign UI structure.

1. Read current Content/RuleModule manifest and validation contracts before creating any new schema.
2. Reuse existing declarative module validation/capability machinery where possible.
3. Implement validated `module.calendar-profile` projection without executable plugin code.
4. Implement the equivalent ration declarative provider boundary.
5. Missing/invalid providers must fail open to OFF/builtin behavior and must never block ordinary Session/Rest/Action flow.
6. Populate the existing provider selectors only when compatible installed profiles exist.
7. Add focused deterministic tests; do not start the final Codex audit.
