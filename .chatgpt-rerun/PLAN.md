# Rerun Plan Router — SimpleVTT

## Run identity

- Repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- Product integration target: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `common-play-foundation-convergence`

## Architecture charter

`docs/rules/common-play-resolver-architecture-charter.md`

## Product-plan document

`docs/rules/resolver-execution-checklist-v2.md`

Rerun dispatch and merge-approval semantics for this run are governed by `.chatgpt-rerun/README.md`, including the rule that `Rerun 진행` / `리런 진행` performs the merge-approval adjudication defined there. This router references that protocol rather than duplicating it.

Do not duplicate the architecture intent, checklist, scope, acceptance criteria, gate order, migration order, or next product action in this file.
