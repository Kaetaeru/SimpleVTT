# Rerun Status

**Connection:** `agent/resolver-foundation-convergence` -> `work/v1-composite` · existing run · Common Play / D&D Rules Resolver

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `common-play-foundation-convergence`
- Control to publish: `needs_user`
- Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- Product plan: `docs/rules/resolver-execution-checklist-v2.md`
- Reconciled at: `2026-08-28 Asia/Seoul`

## Current result

PR #168 `rules: dispatch installed Common Play through production authority` remains open, mergeable, and non-draft at exact head `da4ffecd2de1b7f95d324e7170312cdd8d512797`.

Exact-head workflow evidence is fully green and was reused rather than rerun:

- Contract validation: SUCCESS;
- M1 Common Play Resource Economy: SUCCESS;
- Rules Domain: SUCCESS;
- UI: SUCCESS;
- Phase 11 Playable: SUCCESS;
- Phase 12 Connected Session: SUCCESS.

Focused review confirms that the candidate routes arbitrary installed data-only Common Play mechanics through the existing generic Resolver and shared authoritative commit path, including Character resource writeback, turn/session/history projection, and Undo. The production regression uses arbitrary external identities and an unrelated Fighter `Second Wind` resource, so the dispatcher is not selecting behavior from Action Surge IDs/names.

This is sufficient evidence for PR #168 to be treated as the Resource/Economy PRODUCTION integration candidate. It is not sufficient for MIGRATED: the named Fighter Action Surge production adapter must remain as the behavior oracle until built-in Action Surge is proven through the same generic path with parity, two-resource spend, restricted extra-action semantics, Undo, and connected convergence.

The current convergence parent is `a94f024708ae9a7f8071cf7837244ca16c1282cd`. Its commits newer than PR #168's recorded base are Rerun coordination state; PR #168 remains mergeable.

## Next

Wait solely for explicit owner merge approval for PR #168 at exact head `da4ffecd2de1b7f95d324e7170312cdd8d512797`. On approval, perform the mandatory preflight, confirm PR head/mergeability/exact-head validation remain unchanged, then merge into `agent/resolver-foundation-convergence` and update canonical Resource/Economy maturity/evidence. Do not remove the named Fighter Action Surge oracle in that merge.

Per `.chatgpt-rerun/README.md`, while STATE/control are waiting solely for this named PR merge approval, the owner command `Rerun 진행` or `리런 진행` is sufficient approval for this PR only.

`STATUS.md` is human-facing only. Authoritative state is STATE plus `control.json`, with control written last.
