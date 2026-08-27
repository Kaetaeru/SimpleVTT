# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T07:43:27+09:00`

## Durable checkpoint

Mandatory preflight for this run was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity reconciled cleanly as sequence `2`, task `common-play-foundation-convergence`, control `continue`. `CANONICAL_ROOT.md`, `docs/rules/resolver-execution-checklist.md`, and `docs/rules/gate-e-spatial-fact-execution-packet.md` were then re-read. Previously validated Gate A-D work was not repeated.

Canonical product-plan pointer remains:

`docs/rules/resolver-execution-checklist.md`

PLAN routing did not change in this run and was not rewritten.

## Active Gate E PR

Child implementation branch:

`agent/gate-e-spatial-fact-runtime`

Child PR:

`#141` — `rules: execute generic Common Play spatial fact answers`

At checkpoint:

- PR #141 is open, mergeable, and unmerged;
- head: `1c5cd2309d29f0b71240da6554af77178b1f342c`;
- base: `agent/resolver-foundation-convergence`;
- live diff is exactly eight files:
  - `.github/workflows/gate-e-spatial-fact.yml`
  - `schemas/common-play-contract.schema.json`
  - `src/domain/commonPlayMovementRuntime.ts`
  - `src/domain/commonPlaySpatialFactRuntime.ts`
  - `src/domain/targeting.ts`
  - `tests/domain/commonPlayMaplessTargeting.test.ts`
  - `tests/domain/commonPlayMovementRuntime.test.ts`
  - `tests/fixtures/play-contract/instant-area-targets.json`
- PR body was updated to record current red/green evidence and the remaining connected-authority boundary;
- PR #141 is not approved for merge and must not be merged implicitly.

## Gate E work completed and verified in this sequence

### E1/E2 typed spatial facts and mapless targeting

`src/domain/commonPlaySpatialFactRuntime.ts` now provides a generic registered fact boundary for:

- `boolean`;
- `number`;
- `string`;
- deterministic `targets`;
- opaque `destination`.

Provider and manual-authority answers normalize through the same fact result. The runtime preserves resolution identity, expected revision, idempotency identity and provenance, rejects stale/identity/type mismatches, and never computes geometry.

Mapless targeting red was captured at `02e53a735019bf771e01afc001fa7c6ea4e84f86`: Gate E run `33122252479` produced `7/9` PASS with exactly two intended failures because `resolveTargeting()` unconditionally required authoritative distance.

The initial fix made the public `TargetFacts` fields optional and exposed an exact typecheck regression. That broad type weakening was corrected rather than patched at call sites.

Final mapless-targeting correction at `59c4ea2dc721368d6135a2e88321a65fcfb1d473`:

- existing `TargetFacts` remains strict for existing callers;
- `TargetingFactInput` is the relaxed input boundary for `resolveTargeting()` only;
- distance is required only for declared range semantics;
- visibility only for sight semantics;
- cover only for direct-target cover semantics;
- provided invalid facts still reject;
- no missing spatial value is fabricated.

Exact evidence at `59c4ea2d...`:

- Gate E Spatial Fact `33122611047`: SUCCESS including typecheck;
- Rules Domain `33122610992`: SUCCESS;
- Contract validation `33122611022`: SUCCESS.

Do not repeat this evidence unless affected product/runtime/test files change.

### E3 instantaneous area metadata

Concrete schema red:

- fixture head `1baeb029e14b966aef3a0e03a03594b1c2c338a6`;
- Contract run `33122717609`, job `98693342568`;
- failure was exactly that selector `targeting.area` was not a persisted Common Play property.

Minimal persisted metadata was added at `cdf79016d95d82bd1b184b80a269d1b081357ad4`:

- `kind: "instant"`;
- proven shape only: `shape: "sphere"`;
- `origin: "self" | "point"`;
- positive `radiusFeet`;
- optional nonnegative `rangeFeet`;
- `area` only on selectors whose source is `targets`;
- metadata only; Core still performs no geometry/raycast.

Exact evidence at `cdf79016...`:

- Contract validation `33122809147`: SUCCESS;
- Gate E Spatial Fact `33122809115`: SUCCESS;
- Rules Domain `33122809117`: SUCCESS;
- connected/UI/playable downstream runs associated with that head were also green.

Do not repeat this evidence unless affected files change.

### E4 legal destination / movement orchestration

Repository inspection established that Core stores no authoritative map position. Existing `move`/`free-move` primitives represent movement economy/rule validation, so mapping `push`, `pull`, or `teleport` to normal `move` would silently change semantics.

Concrete E4 red was captured before implementation:

- red workflow head `ee2e42f2846b3735c0a91534b6c0b526375b4dcb`;
- Gate E run `33123174007`, job `98694873221`;
- all existing Gate E tests stayed green and the new movement proof alone failed because `commonPlayMovementRuntime` did not exist.

Minimal `src/domain/commonPlayMovementRuntime.ts` was then added. It:

- accepts an already-normalized semantic destination answer;
- preserves destination as an opaque string instead of inventing coordinates;
- verifies query/fact/subject identity;
- compiles only `movement.relocate` with `mode: "move"` and a finite nonnegative literal distance into the existing authoritative Resolver `move` operation;
- explicitly returns unsupported for `push`, `pull`, `teleport`, and unsupported/nonliteral distance expressions instead of approximating them.

Current exact green child candidate:

`1c5cd2309d29f0b71240da6554af77178b1f342c`

Exact evidence at that SHA:

- Gate E Spatial Fact `33123267315`: SUCCESS including focused tests and `npx tsc --noEmit`;
- Rules Domain `33123267343`: SUCCESS;
- Contract validation `33123267291`: SUCCESS;
- UI `33123267328`: SUCCESS;
- Phase 11 Playable `33123267297`: SUCCESS;
- Phase 12 Connected Session `33123267293`: SUCCESS.

This evidence covers the current E1-E4 domain/schema candidate. Do not rerun it merely to reconfirm state.

## Remaining Gate E work

The remaining unimplemented foundation boundary is connected manual-authority routing.

Existing connected infrastructure inspected in this run already provides the needed transport/ownership primitives:

- `connectedSessionRuntimeAdapter.ts` keeps accepted peer → manifest mappings in `state.peerManifests`;
- each accepted manifest carries the connected Character identity;
- reconnect of the same accepted Character identity replaces/rebinds the peer mapping;
- `sendConnectedWireTo(peer, ...)` already provides peer-private delivery;
- inbound connected responses already use thin registered route/port patterns for interrupt and concentration responses;
- `HostSessionLedger` already owns shared authoritative event ordering/cursors;
- therefore do not introduce a second transport stack or projection-context switching.

The previously rejected broad projection-context switching pattern remains forbidden because it regressed unrelated connected mechanics.

## Next Exact Action

Resume on `agent/gate-e-spatial-fact-runtime` from head `1c5cd2309d29f0b71240da6554af77178b1f342c` unless GitHub has advanced it.

1. Fresh-check PR #141/head before editing.
2. Add a deterministic **connected manual-authority red test first**. The bounded scenario must prove, using the existing session ownership model:
   - an `authority-only` generic `CommonPlayAuthorityFactRequest` for an owner-backed Character routes only to the peer whose accepted manifest owns that Character;
   - no broadcast/private fact leak occurs;
   - wrong session and wrong peer/owner responses reject;
   - the correct response normalizes through `answerCommonPlayFactRequest`;
   - stale revision rejects;
   - duplicate response delivery cannot produce a second authoritative answer;
   - reconnect/rebind may let the same accepted Character identity answer an unanswered request from its new peer, but cannot revive an already answered request.
3. Only after the red is demonstrated, add the smallest generic connected implementation:
   - generic fact request/response wire envelopes in the existing `ConnectedWireMessage` protocol;
   - strict wire validation;
   - a thin generic fact response/request state/route port using current peer ownership maps;
   - existing `sendTo(peer, ...)` for authority-only delivery;
   - advertise a connected capability if the new wire contract requires it;
   - no feature-specific UI/transport engine and no projection-context switch.
4. After connected product/test files change, run only the impacted exact-head validation needed for that new change. Phase 12 Connected Session and typecheck are mandatory; the final Gate E candidate must also carry the checklist-required focused/contract/domain evidence, but do not rerun unchanged evidence prematurely.
5. When connected routing is green, update the Gate E checklist/evidence on the product branch as appropriate, then stop at the owner merge-approval boundary for PR #141.
6. Do not merge PR #141, route to `main`, start Phase 2, or activate Gate F+ without the required completion/approval transition.
