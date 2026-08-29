# Rerun Plan Router — SimpleVTT

## Run identity

- Repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/v1-common-play-full-convergence`
- Product integration target: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `5`
- task_id: `v1-common-play-c8-rerun`

## Architecture charter

`docs/rules/common-play-resolver-architecture-charter.md`

## Product-plan document

`docs/rules/v1-common-play-c8-rerun-plan.md`

Rerun dispatch and merge-approval semantics are governed by `.chatgpt-rerun/README.md`. The owner has explicitly chosen ChatGPT Rerun for direct sequence-5 C8 implementation; do not hand this work to Codex unless the owner later changes direction.

Do not duplicate architecture intent, checklist scope, acceptance criteria, gate order, migration order, or the next product action in this router.
