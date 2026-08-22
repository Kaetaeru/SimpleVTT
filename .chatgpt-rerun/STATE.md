# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T04:03:00+09:00`

## Run continuity

This is the existing active Rerun run. Do not create a new run_id, reset sequence, or replace task_id. Preserve prior exact-head Phase 13 evidence, Ready/connected work, and V1-11 Campaign lifecycle implementation/validation history.

## Active V1 contract

- Finish all intended V1 functionality through real production paths.
- Preserve the current visible SimpleVTT UI structure/style/navigation as the V1 baseline.
- Prefer authority/persistence/runtime wiring behind existing screens over redesign.
- Do not run a comprehensive Codex audit per slice.
- Freeze one exact pre-V1 canonical SHA only after implementation is complete, then run the comprehensive Codex audit.

## Preflight for this dispatch

- Read mandatory Rerun files in order: README -> control -> STATE -> PLAN.
- Reconciled `continue`, sequence `1`, task `phase14-production-play-session-ux`.
- Confirmed `work/v1-composite` remains canonical.
- Re-read V1 handoff/checklist and Campaign provider design.
- Did not repeat V1-11 or previous Ready/Phase 13 work.

## Completed in this dispatch — V1-12 declarative provider core/runtime

Reused the existing declarative RuleModule / InstalledContent / Catalog stack rather than creating a second plugin system.

### Provider contracts and safety

- `4d14cd8` — focused parser/calendar roundtrip contract.
- `3e364dd` — installed-content Calendar/Ration profile types.
- `b2244d5` — strict data-only provider parser and stable provider identities.
- Unexpected fields such as arbitrary run/script hooks are rejected; month/leap/ration values are bounded and validated.

### Calendar authority

- `ad2eb02` — custom declarative calendar profiles now convert authoritative absolute minutes to and from era/year/month/day/time, including bounded leap-cycle rules.

### RuleModule / InstalledContent boundary

- `e686d9e` / `29e6ee9` — import validation contracts.
- `d1977e1` — RuleModule package import preserves `campaignProvider` data.
- `fc5229f` — provider content must be category `option` and its module must declare the matching `campaign.calendar-profile` or `campaign.ration-profile` capability.
- `a2974b6` — persisted installed-content generations revalidate provider payloads on decode/restart.
- `2f99068` / `abee49f` — provider metadata is projected read-only through the existing Catalog; no duplicate provider repository was introduced.

### Campaign authority/runtime

- `412047f` — Campaign application service accepts validated optional profiles, pins `providerVersion`, performs custom calendar projection/correction/undo/day advance, and applies ration defaults inside the authoritative Campaign mutation.
- Explicit roster ration override remains highest priority; provider kind default/global default follow; builtin fallback is 1.
- Shortage remains warning/ledger only; no automatic damage/exhaustion.
- `c97a3d0` — Catalog provider descriptor lookup.
- `386814a` — production Campaign runtime resolves installed providerId/providerVersion and supplies profiles to authoritative mutations.
- Missing custom provider does not make `getSnapshot()` fail; only provider-specific mutations fail explicitly.
- `dacb1fd` — production runtime contract covers RuleModule install -> Campaign selection -> version pin -> custom calendar correction -> ration consumption plus restart with the provider missing.

## Validation status

- Focused deterministic tests are present in source.
- These new provider tests are not yet wired into the canonical UI workflow in this checkpoint.
- Exact-head TypeScript/build/Actions result has not been observed; do not claim green/DONE.
- Comprehensive Codex audit remains intentionally deferred until all V1 implementation is complete.

## Current functional boundary

V1-12 provider **core/runtime is implemented, but the user path is still incomplete** because `CampaignSystemsPanel` still shows the old disabled module-provider placeholders.

No broad UI changes were made in this dispatch.

## Next Exact Action

Finish the V1-12 provider user path inside the current Campaign UI.

1. Derive installed Calendar/Ration provider descriptors from `snapshot.catalog`.
2. Keep the existing provider `<select>` controls; append compatible installed provider options and keep the disabled placeholder only when none exist.
3. If multiple versions of the same provider are installed, display/use the same newest-version selection rule as runtime and persist the selected version.
4. For custom Calendar, keep the existing date editor but use profile months and show year/month/day rather than Simple Day fields.
5. For custom Rations, make the preview use profile defaults; show shortage consequences as explanatory suggestions only, never automatic damage/exhaustion.
6. If a currently selected provider is unavailable, show a clear unavailable state but do not block the Campaign screen, Session, Rest, or unrelated actions.
7. Add `campaignDeclarativeProviderProfile`, `campaignDeclarativeProviderImport`, and `campaignDeclarativeProviderRuntime` to canonical UI workflow and obtain focused TypeScript/build evidence when available.
8. After provider UI is complete, continue V1-12 with authoritative Long Rest + optional Campaign time advance + optional ration consumption compound write.
