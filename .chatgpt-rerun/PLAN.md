# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library privacy/materialization, Party Stash policy/approval/owner compensation, terminal Player outcome FIFO transport, and existing connected transfer tests. Comprehensive Codex audit remains deferred until implementation freeze.

## Reconciliation

This execution re-read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and the relevant Campaign/ration/transfer design contracts.

At dispatch start `work/v1-composite` was identical to prior coordination head `e64d9d8ece4644f783c95f14007d3d06f574f8a7`. The old V1-13 selector/approval TODO prose in handoff/checklist remains stale and was not replayed. Immediately before coordination writes the branch was exactly 14 commits ahead of `e64d9d8...`, all attributable to this execution's ration conversion production/runtime/UI/test work; no divergent concurrent writer was observed.

Latest product/test boundary: `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11`.

## Completed in this execution — ration conversion production path

The prior domain slice through `8339b2a...` is now connected to production source without creating another Campaign repository or asset mutation path.

### Trusted item capability authority

- `7f3528fd6a8095f4994de222d1e0b5e4999670d9` added `campaignPartyStashCapabilityRuntimeAdapter.ts`.
- Character -> Stash item metadata is normalized against the Host/current adapter `CatalogEntry` identified by definition ID. Exactly one matching item definition is required; absent/ambiguous definitions yield no trusted capabilities.
- Player-supplied `itemTemplate.capabilities` therefore cannot make an item ration-compatible.
- Both normal Host/local `transferPartyStash` and connected Host `commitConnectedPartyStashDeposit` use the normalization wrapper.
- `2dbef2844111bdb0bf4b4238aeceb0c3de657400` exposed the same trusted resolver for conversion-time revalidation.

### Same Campaign service / connected projection reuse

- `3bdac7d71d286914f640e85d9e4a4ab38b9366b0` added `campaignRationConversionRuntimeAdapter.ts`.
- Production composition was installed after `campaignRuntimeAdapter` in `aa6d99d469115f3c77f9aa1518aa8773ade0c89a`.
- Conversion does not instantiate a second `CampaignLibraryRepository`. It carries a private runtime payload through existing `MockAdapter.adjustCampaignRations`, whose underlying `CampaignApplicationService` instance is the same service/repository context already used for Campaign writes.
- `CampaignApplicationService.adjustRations` delegates ordinary adjustments unchanged; only the private conversion payload routes to the existing atomic `convertPartyStashItemToRations` helper.
- Connected runtime already wraps `adjustCampaignRations` with `broadcastAfter`, so conversion uses the established Campaign systems projection/broadcast path rather than a new transport.
- `97992eb2ce5caab3e88135fa7bb9e4cf859100df` rejects Client preview/commit and revalidates the exact ration provider ID/version before module-profile lookup.
- `9afea500ab5f198df821fab7bdef8d289440696c` + `278922f668bf49d34deed8c1f2b8a2785ed46e26` make preview and commit re-resolve item eligibility from the current trusted Host Catalog. Persisted Stash capability snapshots are provenance/cache only, not final authority.

This also removes the need for a destructive migration of pre-feature Stash items. A legacy Stash reference with no `itemTemplate`/capability snapshot can convert if its current unique Catalog definition declares a compatible capability; if the definition is missing or ambiguous, conversion is rejected.

### DM preview/action

- `397f3d56af38d070723751086624d6d95b44b2f4` added `CampaignRationConversionPanel.tsx`.
- `762f3cae6433180151d5824689830d95018e37c4` mounts it on the active Campaign dashboard.
- DM chooses an exact Stash item and integer quantity, requests authoritative preview, sees source quantity before/after, ration units per item, total gain, ration balance before/after, and pinned provider ID/version, then explicitly commits.
- UI explicitly states that item name/description are not used to infer food compatibility.

### Source-authored production tests

- `9753335f744dc1bb37361f346af21c0f68f92375` covers Host Catalog normalization, forged Player capability removal, preview, commit, and same-request idempotency through the production runtime path.
- `dee3aff7aefc8fb3e16a20c12d676c8883f47ba1` adds stale provider-pin rejection with unchanged Campaign state.
- `9d330333601a34e796c9a50dd57e05f04f4abc3d` / `cf32bcd32af719e4906d8b0e741631667f96cfc9` pin production composition, trusted revalidation, existing connected broadcast reuse, and DM preview mounting.
- `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11` covers a legacy Stash item with no template/capability snapshot converting from a current trusted Catalog capability.

## Validation status

**NO GREEN CLAIM.** The latest product/test boundary has no combined GitHub statuses and no commit-associated workflow runs. Local exact-head execution still cannot start because the environment cannot resolve `github.com` (`Could not resolve host: github.com`).

No Node test, TypeScript compile, npm/build, Tauri/Rust, or Windows two-instance result is claimed. Source-authored tests and static source reconciliation are not executable evidence.

## Selective V1-13 re-audit

The canonical Party Stash ration-conversion requirement is now source-connected but validation pending.

Remaining observations:

1. A bundled out-of-box item declaring `campaign.ration-source` has not yet been confirmed. Inspected SRD adventuring-core, starting-utility, and pack module data do not currently show a ration item/capability. Do not infer compatibility from an item name to fill this gap.
2. The next clear DM Library source gap is PC preset plus folder organization. `CampaignDmLibraryEntry` includes `pc-preset` in its kind union, but the current Campaign Library UI/editor only exposes custom item, image, and NPC definition; folder state/workflow is also absent.
3. Checklist status remains stale/TODO and must not be changed to DONE without exact-head executable evidence and later acceptance.

## Remaining work

1. Obtain executable exact-head focused tests + TypeScript/build evidence for approval and ration conversion before any green claim.
2. Decide/implement an authoritative bundled ration-compatible content declaration if V1 requires an out-of-box convertible ration item. This must be explicit content data, never display-name inference.
3. Implement the next V1-13 source slice: Campaign DM Library PC preset and folder organization, preserving Campaign namespace isolation and private connected projection rules.
4. Re-audit remaining V1-13 quick actions/source distinction after PC preset/folder work.
5. Windows two-instance acceptance remains a later gate.
6. Comprehensive Codex audit remains deferred until implementation freeze.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve product/test source through `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11` unless GitHub advanced.
2. If an exact-head runner becomes available, first run ration conversion domain/runtime/structure/legacy tests plus approval tests and TypeScript/build; fix real failures before green claims.
3. If execution remains unavailable, inspect the canonical SRD/content-generation source for an explicit ration item capability. Add one only if the source/content contract supports it; never derive it from names.
4. Then implement DM Library PC preset + folder data/runtime/UI/tests as the next clear V1-13 source gap.
5. Re-audit V1-13 after that slice; keep comprehensive Codex audit deferred.
