# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T04:43:00+09:00`
- Tauri compound transaction: `908d7e1`
- Tauri recovery/command wiring: `ae42e81`
- Mutex lifetime fix: `fed7ed7`
- TS compound writer: `88cc8a7`

## Human summary

V1-12 authoritative Long Rest work advanced past the production persistence blocker.

Character and Campaign no longer need to be committed as two unrelated Tauri writes for the future compound Rest flow. The new transaction layer:

- preflights both immutable generation heads;
- durably stages both payloads;
- creates one commit marker only after both stages are synced;
- treats that marker as the commit point;
- completes/materializes both generations after commit;
- preserves the marker across committed interruption so the next Character/Campaign read/write recovers both sides before normal access resumes;
- shares one process mutex across normal Character/Campaign persistence and the compound command.

A Tauri TypeScript writer now calls `write_character_campaign_compound`. Deterministic Rust fault tests and the existing Tauri structure regression were authored/updated, but no Rust/TypeScript execution result was observed, so this is not reported as green yet.

Production UI inspection also established that there is no generic Long Rest control today. The minimum compatible V1 surface is a small Long Rest preview/options/action block inside the existing `SessionCampaignPane`, not a new screen or redesign.

Next work is the production coordinator behind that UI: reuse canonical Character Long Rest resolution plus CampaignApplicationService's provider-aware Calendar/Ration authority, prepare both next generations, invoke the compound writer once, and update runtime projections only after success. OFF/missing Calendar/Ration must disable only those optional side effects and never block Rest itself.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
