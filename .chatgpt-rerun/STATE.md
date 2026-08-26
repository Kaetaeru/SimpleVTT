# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T14:43:57+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in the required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live/canonical routing was reconciled. Run/sequence/task identity is unchanged.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, and Berserker Intimidating Presence R1 remain source-complete/execution-validated.

Active R1 is **Monk Open Hand — Wholeness of Body**. Existing mechanics-domain implementation is reused; no new generic engine was introduced.

Wholeness implementation chain already present and must not be duplicated:

- `1ca17f135fb41e805b1a044535ba764f9f8be019` — production Wholeness adapter using the existing domain resolver, resource definition, ResolutionEvent application/write-back, Activity projection, runtime history, and generic Undo boundary.
- `bd76d7fc9602005a7d982784375a624e52359781` — focused initiative projection/resource/healing/Bonus Action/Activity/Undo coverage.
- `f6f965a50b311ab341396da0579a2ea0c0d92c6a` — canonical offline adapter install.
- `1db96f19e86dbc6017c20e0144632b3173ed48fc` — `test:open-hand-wholeness` added to canonical `npm run build`.

Checkpoint `1db96f19e86dbc6017c20e0144632b3173ed48fc` is green:

- UI run `32934685748`, frontend job `98073537891`: **success**, including `Typecheck and build`.
- Phase 12 run `32934685775`: connected authority protocol and production frontend gate **success**.

The freeform non-stranding gap was then addressed by concurrent commits and must not be reimplemented:

- `d7916ffe5d541fdb091adf72af722024c538f78e` routes Wholeness economy through the domain resolver with a context flag so Bonus Action is consumed only in initiative while resource/healing events remain shared.
- focused coverage now includes freeform healing/resource/Activity/Undo and verifies no Bonus Action spend.
- the first freeform regression revision was red because its helper had not actually switched the adapter into `freeform` mode.
- `eafaff11101f6576ac46efe8eb4b6f8fd72d29a8` fixes only that fixture by explicitly calling `setSessionMode("freeform")`; do not duplicate this fix.

Exact-head validation for source checkpoint `eafaff11101f6576ac46efe8eb4b6f8fd72d29a8` is still running at this durable checkpoint:

- UI run `32935101447`, frontend job `98074719852`: all observed pre-build steps green; `Typecheck and build` was **in progress**.
- Phase 12 run `32935101467`, connected-protocol job `98074719995`: authority protocol and offline walkthrough green; `production frontend gate` was **in progress**.

Do **not** mark Wholeness R1 complete or advance canonical routing until both exact-head gates finish green. Do not rerun previously green R1 work. `PLAN.md` remains unchanged. Connected remote-owner exactly-once/reconnect remains R2 and excluded.

## Next Exact Action

Reconcile live `work/v1-composite` first because concurrent commits may advance beyond `eafaff11101f6576ac46efe8eb4b6f8fd72d29a8`. If source-equivalent Wholeness HEAD has not changed, inspect UI run `32935101447` and Phase 12 run `32935101467` to completion. If red, fix only the first Wholeness-related failure. If both are green, mark Wholeness R1 source-complete/execution-validated, advance canonical V1 handoff/checklist to the next smallest mechanics-complete subclass action candidate, then publish durable `STATE.md` followed by `control.json` last. Keep R2 excluded.
