# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `needs_user`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T08:06:43+09:00`

## Durable checkpoint

Mandatory preflight for this continuation was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity reconciled cleanly as sequence `2`, task `common-play-foundation-convergence`, control `continue`. `CANONICAL_ROOT.md`, `docs/rules/resolver-execution-checklist.md`, and `docs/rules/gate-e-spatial-fact-execution-packet.md` were then re-read. Previously validated Gate A-D and Gate E E1-E4 work was not repeated.

Canonical product-plan pointer remains:

`docs/rules/resolver-execution-checklist.md`

PLAN routing did not change and was not rewritten. The checklist intentionally remains Gate E `ACTIVE` until the implementation PR is actually merged; it was not prematurely marked DONE.

## Active Gate E PR

Child implementation branch:

`agent/gate-e-spatial-fact-runtime`

Child PR:

`#141` — `rules: execute generic Common Play spatial fact answers`

Current exact candidate/head:

`12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba`

Live PR facts at checkpoint:

- PR #141 is open, mergeable, and unmerged;
- base is `agent/resolver-foundation-convergence`;
- compare reports `ahead_by=18`, `behind_by=5`, `status=diverged` because the parent has Rerun coordination commits after the original merge base;
- the product diff is exactly 13 intended Gate E files and contains no unexpected parent-only product file:
  - `.github/workflows/gate-e-spatial-fact.yml`
  - `schemas/common-play-contract.schema.json`
  - `src/app/connectedCommonPlayAuthorityFactRuntime.ts`
  - `src/app/connectedSessionRuntimeAdapter.ts`
  - `src/app/connectedSessionWire.ts`
  - `src/domain/commonPlayMovementRuntime.ts`
  - `src/domain/commonPlaySpatialFactRuntime.ts`
  - `src/domain/targeting.ts`
  - `tests/domain/commonPlayMaplessTargeting.test.ts`
  - `tests/domain/commonPlayMovementRuntime.test.ts`
  - `tests/fixtures/play-contract/instant-area-targets.json`
  - `tests/ui/connectedCommonPlayAuthorityFactDispatch.test.ts`
  - `tests/ui/connectedCommonPlayAuthorityFactRouting.test.ts`
- PR body has been updated with the final red/green evidence and explicit owner-approval boundary;
- PR #141 must not be merged implicitly.

## Gate E E1-E4 evidence retained from the prior checkpoint

Do not repeat these validations merely to reconfirm them. They were already green before the connected routing slice:

- mapless targeting red `02e53a735019bf771e01afc001fa7c6ea4e84f86`, Gate E run `33122252479`: 7/9 pass with exactly the intended unconditional-distance failures;
- E3 schema red `1baeb029e14b966aef3a0e03a03594b1c2c338a6`, Contract run `33122717609`, job `98693342568`: `targeting.area` absent from persisted contract;
- E4 movement red `ee2e42f2846b3735c0a91534b6c0b526375b4dcb`, Gate E run `33123174007`, job `98694873221`: new movement proof alone failed because `commonPlayMovementRuntime` did not exist;
- previous E1-E4 green candidate `1c5cd2309d29f0b71240da6554af77178b1f342c` had Gate E, Rules Domain, Contract, UI, Phase 11, and Phase 12 green.

## Connected manual-authority routing completed in this continuation

Repository inspection confirmed the existing connected session already provides the required authority/transport primitives:

- accepted peer -> `SessionCompatibilityManifest` mappings in `state.peerManifests`;
- Character identity in each accepted manifest;
- same-Character reconnect/rebind replacing the peer mapping;
- peer-private `sendConnectedWireTo(peer, ...)` delivery;
- existing thin inbound response-port/message-loop pattern;
- Host authority remains the shared resolution authority.

No second transport stack or projection-context switching was introduced.

### Connected coordinator red

Exact red head:

`0f989335a25ee65821d4df0d9c0c7d1ea29a80f1`

Gate E run `33124115235`, job `98697981604`:

- the new connected authority-routing focused step failed before product implementation;
- the missing reusable capability was exactly the absent generic `connectedCommonPlayAuthorityFactRuntime` coordinator;
- no product implementation had been added at that red point.

The red fixture pins:

- `authority-only` fact request goes only to the peer whose accepted Character identity owns the responder;
- wrong Client Character, session, responder, or current owner peer rejects;
- correct answer normalizes through `answerCommonPlayFactRequest` with authority provenance;
- duplicate delivery cannot publish a second authoritative answer;
- stale revision closes rather than revives the request;
- unanswered request may resend to a new peer after same-Character rebind;
- old peer loses authority after rebind;
- resolved/stale request cannot revive after later reconnect.

### Generic coordinator/wire implementation

Added `src/app/connectedCommonPlayAuthorityFactRuntime.ts` and generic connected wire messages:

- `common-play-fact-request`;
- `common-play-fact-response`.

The coordinator:

- stores pending/completed/closed state per adapter/session;
- resolves owner peer from existing `peerManifests` Character identity;
- uses existing peer-targeted transport for private prompts;
- validates session/responder/current owner peer;
- delegates semantic answer validation to `answerCommonPlayFactRequest`;
- provides first-answer-wins idempotency without a second callback/apply;
- retains Client answer identity so a Host retry may replay the already-supplied response;
- resends only still-pending requests on same-Character rebind.

No named content branch, geometry engine, feature-specific transport, or projection-context switch was added.

Intermediate exact head `569008345d0a7eb34e695d68995a50b2cd7f067c` proved the coordinator/wire focused tests and TypeScript typecheck green, but was not treated as Gate E completion because the real connected message loop was not yet wired.

### Production message-loop red

Exact red head:

`f5f4d753a4a2385cd57997e150d10cb27ab45703`

Gate E run `33124479006`, job `98699176336`:

- coordinator/wire existed;
- the new production dispatch integration test failed because real `connectedSessionRuntimeAdapter` did not yet dispatch the two generic Common Play fact messages.

This prevented a false green based only on a unit-level coordinator.

### Production message-loop correction

`src/app/connectedSessionRuntimeAdapter.ts` now:

- advertises `common-play-authority-fact-v1`;
- registers the generic coordinator against the existing `sendConnectedWireTo` / broadcast transport;
- resumes still-pending owner fact requests after an accepted same-Character hello/rebind;
- routes Host `common-play-fact-response` into the generic coordinator;
- routes Client `common-play-fact-request` to the active Character ownership check;
- uses the existing session message loop rather than a parallel protocol stack.

## Final exact-head verification

Final Gate E candidate:

`12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba`

Do not rerun these green checks unless product/runtime/test files change.

### Required Gate E focused evidence

Gate E Spatial Fact run `33124577135`, job `98699500259`:

- focused command covers spatial fact runtime, mapless targeting, movement orchestration, connected owner routing/reconnect, and production Host/Client message-loop dispatch;
- **15/15 PASS, 0 FAIL**;
- `npx tsc --noEmit`: PASS.

### Contract / domain / UI / playable / connected regression

On the same exact SHA:

- Contract validation run `33124577119`: SUCCESS;
- Rules Domain run `33124577116`, job `98699499753`: SUCCESS, including application typecheck;
- UI run `33124577166`: SUCCESS;
- Phase 11 Playable run `33124577172`, `offline-walkthrough` job `98699500325`: SUCCESS, including the full production frontend gate;
- Phase 12 Connected Session run `33124577117`, `connected-protocol` job `98699499728`: SUCCESS, including connected authority protocol regression, Phase 11 offline walkthrough regression, and production frontend build.

At this checkpoint the downstream Windows artifact jobs in Phase 11 and Phase 12 were still running. They are not being used as the Gate E semantic/authority proof. On any merge-approval continuation, read their existing final conclusions; do not rerun them merely to obtain a result.

### Unrelated persistence baseline

Persistence run `33124577216` remains the pre-existing unrelated baseline:

- `74/75` persistence-adapter tests pass;
- sole failure: `tests/app/installedContentRuntimeAdapter.test.ts` with `501 !== 496`;
- Gate E's 13-file diff does not touch that adapter/catalog-count baseline;
- Windows `tauri-storage` job is green.

Do not classify this as a Gate E regression.

## Current Gate E status

Implementation and required exact-head Gate E semantic/authority evidence are GREEN.

Gate E is **not canonical DONE** because PR #141 is still open and owner merge approval is required by the checklist.

No Gate F+ work was activated. Phase 2 Legacy Convergence has not started.

## Next Exact Action

Owner decision required: explicit merge approval for PR #141.

If the owner approves PR #141:

1. perform mandatory Rerun preflight again in exact order: README -> control -> STATE -> PLAN;
2. fresh-fetch PR #141, its head, current parent head, changed filenames, and compare;
3. read the already-running downstream Windows workflow conclusions if they have finished; do not repeat validated Gate E tests;
4. if parent/child divergence is still coordination/docs-only and the 13-file product/runtime/test diff is unchanged, reconcile ancestry without changing the validated product tree and without rerunning green evidence;
5. verify PR #141 is mergeable with the expected reconciled head;
6. merge PR #141 only with the explicit owner approval;
7. after merge, update `docs/rules/resolver-execution-checklist.md` to mark Gate E DONE / Foundation frozen through E and record canonical merge evidence;
8. then update STATE and control last; Phase 2 becomes the next canonical product queue, while Gate F+ remains dormant unless a later concrete migration failure separately satisfies its activation rule.

Until owner approval, do not merge PR #141, route to `main`, start Phase 2, or activate Gate F+.
