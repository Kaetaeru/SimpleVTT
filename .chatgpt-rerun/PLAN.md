# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all existing V1-12/V1-13 durability, Campaign authority, Party Stash approval/compensation/outcome work, ration conversion authority, bundled ration source, and DM Library privacy/materialization/organization work. Do not replay stale selector/approval TODO prose. Comprehensive Codex audit remains deferred until implementation freeze.

## Reconciliation

This execution re-read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order and reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/campaign-systems.md`, and actual `work/v1-composite` state.

At dispatch start the branch was identical to coordination head `a07124eb39e07be9d3a83d6a2c9a5367357262d4`. Immediately before coordination writes it was exactly 8 commits ahead, all attributable to this execution. No divergent concurrent writer was observed.

Latest product/test boundary: `9632f5119be427c200b5e1aa92a432df7edd27ca`.

## Completed in this execution

### Live Session PC preset quick add

- `290da001a8729fc4913cddd736fa4b2ec9b6d32f` — `SessionDmEncounterPane` now lists Campaign `pc-preset` entries alongside existing `npc-definition` entries.
- The action calls the already-established authoritative `mockAdapter.instantiateCampaignDmLibraryPcPreset(campaignId, entryId)` runtime and then `refresh()`es the AppProvider snapshot. The underlying runtime still materializes a `CombatantDefinitionVm` and calls existing `instantiateCombatant`; no parallel actor mutation path or Player Character ownership path was added.
- Existing `instantiateCampaignDmLibraryNpc` quick add is preserved unchanged.
- `568ef5fda14af10ee71ee890c0c7e02c6a9c77d0` — source structure test pins Session preset filtering, DM-only runtime authority, existing Combatant materialization, refresh, and NPC preservation.

### Private DM Library notes

Canonical Campaign design explicitly includes private DM notes together with folders/tags/favorites/recents.

- `dd106907029500ad98c44fc1c895c7916ef01fac` — backward-compatible optional `CampaignDmLibraryEntry.noteText` contract; no schema-version bump.
- `a0fb8aac7f4dbcbdf206d823161fad789e2d21dd` — note writes reuse the existing generic Campaign DM Library upsert transaction and reject blank note bodies after trimming. Existing folder and PC preset validation is preserved; no new store or network route exists.
- `7a3ea5f956567acd8da400ce68c36ecacae8ac98` — `CampaignDmLibraryNotePanel` provides create/read/search/edit/delete, title/body/tag search, folder assignment/filtering, tags, and favorites. UI states that note originals remain Host Campaign data and are not projected to Players.
- `4387160505c0a8b3ba7df62c27cfc62e7dde7803` — mounts the note panel in the active Campaign dashboard without replacing ration or organization panels.
- `3a2885361c0f0d9bfc10fcdfa27a363abe7ea428` — source-authored runtime coverage for blank rejection, normalization, create/update/folder/tags/favorite/delete through the shared Library transaction.
- `9632f5119be427c200b5e1aa92a432df7edd27ca` — source privacy/structure test pins note CRUD/search/folder/favorite and verifies `CampaignSessionSystemsProjection` contains neither `dmLibrary` nor `noteText`.

### Final selective V1-13 Party Stash re-audit

The remaining equipped/wielded/attuned transfer item is already correctly implemented in `sessionInventoryRuntimeAdapter.ts` and was not changed:

- `revoke-item` rejects an equipped, wielded, or attuned item unless `forceUnequip` is explicitly set.
- Explicit force clears `equipped`, `wielded`, `attuned`, and `wieldSlot` inside the same inventory mutation before decrement/removal.
- Undo tracks active state and only restores it when no later conflicting active-state mutation occurred.
- `campaignRuntimeAdapter.ts` already forwards Party Stash `command.forceUnequip` into this authoritative Character inventory command.

No duplicate implementation was added.

## V1-13 source assessment

Static/selective re-audit now finds the canonical V1-13 source requirements covered across:

- DM Library item/image/PC preset/NPC/custom item/note;
- folders/tags/favorites/recents/search and Campaign namespace privacy;
- installed/catalog vs Campaign custom source distinction;
- Session NPC and PC preset Actor quick-add;
- image preview/reveal/reconnect restoration;
- Party Stash item/GP deposit/take-out and shared/dm-approval/dm-managed policies;
- authoritative atomic/idempotent transfer and owner compensation;
- equipped/wielded/attuned explicit handling;
- provider-declared atomic ration conversion and bundled isolated ration source;
- approval terminal Player FIFO outcomes and restart/session cleanup source paths.

Therefore V1-13 is **SOURCE-COMPLETE / VALIDATION PENDING**, not DONE. Do not update the stale release checklist to DONE until exact-head executable evidence and later acceptance exist.

## Validation status

**NO GREEN CLAIM.** Product/test boundary `9632f5119be427c200b5e1aa92a432df7edd27ca` has no combined GitHub statuses and no commit-associated workflow runs. A single local exact-head checkout retry again failed with:

`Could not resolve host: github.com`

No Node test, TypeScript compile, `generate:content`, Vite build, Tauri/Rust, or Windows two-instance success is claimed.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve source through `9632f5119be427c200b5e1aa92a432df7edd27ca` unless GitHub advanced.
2. Prefer exact-head execution as soon as a runner is available: run the DM Library organization/note/Session-preset tests, bundled-ration/ration-conversion tests, Party Stash approval/owner-transfer tests, `generate:content`, TypeScript and build. Fix actual failures before any green claim.
3. If execution is still unavailable, do not invent another V1-13 feature. Reconcile the next unresolved canonical release/checklist boundary from GitHub and begin only a demonstrable source gap, while keeping V1-13 at source-complete/validation-pending.
4. Windows two-instance acceptance remains a later gate. Comprehensive Codex audit remains deferred until implementation freeze.
