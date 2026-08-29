# Rerun Plan Router — SimpleVTT

## Run identity

- Repository: `Kaetaeru/SimpleVTT`
- Rerun coordination branch/ref: `agent/resolver-foundation-convergence`
- Intended implementation branch: `agent/v1-common-play-full-convergence`
- Product integration target: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `5`
- task_id: `v1-common-play-c8-rerun`

## Architecture charter

`docs/rules/common-play-resolver-architecture-charter.md`

## Product-plan document

`docs/rules/v1-common-play-c8-rerun-plan.md`

Rerun dispatch and merge-approval semantics for this run are governed by `.chatgpt-rerun/README.md`. This router references that protocol rather than duplicating it.

The product-plan document owns the recovery prerequisite, C8 remaining legacy-strangler scope, normative correctness rule, C8 exit criteria, and C9 entry conditions. Do not duplicate those details in this router.
