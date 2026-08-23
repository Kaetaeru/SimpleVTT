# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all source-connected V1-12/V1-13 durability, recovery, Campaign authority, Party Stash policy/approval/owner compensation, Player terminal outcome delivery, ration conversion authority, and DM Library privacy/materialization work. Do not replay stale V1-13 selector/approval TODO prose. Comprehensive Codex audit remains deferred until implementation freeze.

## Reconciliation

This execution re-read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, Campaign/ration/transfer design contracts, and actual `work/v1-composite` state.

At dispatch start the branch was identical to coordination head `2fe1628b4648585f0e6faa11ca7246c2d1863161`. Immediately before coordination writes it was exactly 11 commits ahead, all attributable to this execution's bundled ration content and DM Library organization source/test changes. No divergent concurrent writer was observed.

Latest product/test boundary: `22cdc889e0505ce2c7fee5a6d7055c035b9b9742`.

## Completed in this execution

### Bundled out-of-box ration source

Content-generation inspection found that the current built-in generator copies a RuleModule's `capabilities` onto every CatalogEntry in that module. Adding `campaign.ration-source` to a multi-item equipment module would therefore incorrectly make every item in that module ration-compatible.

The safe V1 source shape is an isolated one-item SRD module:

- `6934d20208284aca65edfa82718e4239ed292754` — added `content/modules/dnd-srd-5.2.1.equipment-rations/module.json`.
- Module capability is exactly `campaign.ration-source`.
- The module contains exactly one SRD-derived item: `dnd.srd521.item.gear.rations`, presented as `Rations (1 day)` / `식량 (1일분)`.
- No price, weight, or additional mechanics were guessed merely to fill the content row.
- `2e07e152110bd6fce7254deb9f40ca22ff9e596c` — source structure test pins the isolated capability declaration and generator behavior.

`src/generated/builtinCatalog.generated.json` is not tracked in GitHub; normal dev/build generation produces it. No generated output or executable success is claimed in this environment.

### Campaign DM Library PC preset + folders

Added backward-compatible optional organization/preset contracts without a Campaign schema-version bump:

- `815fddd3947f061ed9d1a86889200878890ed6d5` — `CampaignDmLibraryFolder`, `CampaignPcActorPreset`, optional `CampaignDmLibraryEntry.folderId`, optional `pcPreset`, optional `CampaignDmLibraryState.folders`.
- A PC preset is a Campaign-owned DM Actor template. It is not a Player-owned Character file and does not transfer Character Library ownership.

Runtime:

- `73d79e20329031cb74af436cfa7c859931348738` — added `campaignDmLibraryOrganizationRuntimeAdapter.ts`.
- Folder create/rename/remove uses the existing Campaign `updateCampaign` / `CampaignApplicationService` / repository mutation boundary; no second Campaign store exists.
- Removing a folder preserves its entries and moves them to root rather than deleting assets.
- Entry writes revalidate that a referenced folder exists.
- `pc-preset` validates definition identity, name, level 1-20, AC, max HP, actions/status immunities, source, and version.
- PC preset materialization converts the private Campaign template into the existing `CombatantDefinitionVm` path and calls existing `instantiateCombatant`; it does not write Character Library state.
- Client-side preset Actor materialization is rejected.

UI:

- `ed7caa9e9362c76e827c6a3a1552d05105ffc370` / `efe88f8fdb1d04dfe2634525e3f2fca262a03192` — added full folder and PC preset UI.
- Folders: create/read/rename/delete, all/root/folder filtering, move any DM Library entry between folder/root.
- PC preset: create/read/update/delete, folder assignment, level/AC/HP/actions/tags, Campaign-dashboard `Actor +1`.
- `8df18773ac648aa7066428ad9281c128850658c0` mounts the organization panel on the active Campaign dashboard.

Tests:

- `a7b1aee66098ba989373c69ae0d59fae6a755c10` / `22cdc889e0505ce2c7fee5a6d7055c035b9b9742` — source-authored runtime tests cover folder create/rename/delete/root preservation, folder authority, PC preset create/update/materialize/recents/delete.
- `bd0e4304358af7ab79867d5e981fb95121e9fa0c` / `d2f2666a0f251c7f12779b08cca329f973a26b82` — structure/privacy contract verifies Campaign authority and that private DM Library data remains absent from `CampaignSessionSystemsProjection`.

## Selective V1-13 re-audit

Already source-covered and therefore not repeated:

- DM Library custom item/image/NPC CRUD, tags/favorites/recents/search;
- installed/catalog vs Campaign custom source distinction;
- Character item grant/reclaim, Character <-> Party Stash item movement, GP grant/reclaim;
- Campaign namespace isolation, private connected projection, materialization provenance, definition-delete preservation;
- Session image handout preview/reveal: `SessionImageHandoutBridge` reads Campaign DM Library images, previews locally, reveals to Players, restores current handout for reconnecting/new Players, and supports withdrawal;
- Session NPC quick add: `SessionDmEncounterPane` reads Campaign `npc-definition` entries and calls the existing `instantiateCampaignDmLibraryNpc` path.

New precise gap found:

- The new `pc-preset` has Campaign-dashboard `Actor +1`, but `SessionDmEncounterPane` currently lists only Campaign `npc-definition` entries. The PC preset quick-add action therefore still needs to be exposed inside the live Session DM Encounter workflow.
- After that, the next clear DM Library product gap is the reserved `note` kind: the canonical design includes DM notes, but current Library user paths expose custom item, image, NPC definition, and now PC preset, not note CRUD/search/folder workflow.

## Validation status

**NO GREEN CLAIM.** Product/test boundary `22cdc889e0505ce2c7fee5a6d7055c035b9b9742` has no combined GitHub statuses and no commit-associated workflow runs. Exact-head local execution remains unavailable because the environment cannot resolve `github.com` (`Could not resolve host: github.com`).

No Node test, TypeScript compile, content generation, Vite build, Tauri/Rust, or Windows two-instance result is claimed. Authored source tests/static reconciliation are not executable evidence.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve source through `22cdc889e0505ce2c7fee5a6d7055c035b9b9742` unless GitHub advanced.
2. If an exact-head runner becomes available, run focused ration conversion + bundled content + DM Library organization + approval suites, `generate:content`, TypeScript and build first; fix real failures before any green claim.
3. If execution remains unavailable, wire Campaign `pc-preset` entries into `SessionDmEncounterPane` as a live `Actor +1` path using the existing `instantiateCampaignDmLibraryPcPreset` runtime; expose it through the normal AppProvider/session UI contract rather than creating a second actor path.
4. Add deterministic Session-source tests for PC preset quick add and preserve existing NPC quick add.
5. Then implement DM Library `note` data/UI CRUD with existing folder/tag/favorite/search/private-Campaign boundaries; do not project notes to Clients.
6. Re-audit remaining V1-13 source items after note support. Keep Windows two-instance acceptance and comprehensive Codex audit for later release gates.
