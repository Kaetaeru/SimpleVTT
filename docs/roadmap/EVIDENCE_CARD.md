# V1 Evidence Card

Status: **W7-05 READY FOR EXACT-HEAD REUSE VERIFICATION — NO PRODUCT CHANGE AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-05
Classification: REUSE_LOCKED
Acceptance criterion: DM-only, hidden, and private payloads, Activities, and handout metadata must not leak to unauthorized peers. Canonical scenario mapping: MP-B05~B07 and MP-09.
Production entrypoint: Reuse the existing connected Session projection/redaction, Activity visibility, privacy filtering, and handout projection paths. Do not add a second privacy model, projection layer, Activity log, handout system, transport, or Session authority path.
Existing automated verification: Identify the smallest existing tests that exercise private/hidden projection, Activity redaction/visibility, handout reveal-withdraw/privacy, and unauthorized peer boundaries, then run that focused owner set on one exact integration-derived SHA.
Existing Tauri/Windows evidence: None is required to authorize a product change at this point; first run the existing exact-head focused owners. Any Windows observation required by the canonical scenario/gate mapping must use the existing Tauri/WebDriver runner rather than a second E2E framework.
Exact observed failure: NONE. W7-05 has not yet reproduced a current-HEAD privacy leak or production reachability/contract gap.
Smallest authorized change: NONE. Product/runtime changes remain prohibited until a current-HEAD failure or explicit production reachability/contract gap is reproduced and recorded here.
Verification SHA: PENDING — select from a fresh scoped W7-05 branch created from the latest live work/v1-composite HEAD.
Verification: PENDING exact-head focused owner run.
Artifact: PENDING only if the selected verification path produces an artifact.
Closure: W7-05 remains PENDING until the exact-head focused verification and scenario mapping are recorded in V1_EVIDENCE_LEDGER.json.
```

## Previous Gate closure

`W7-04` is PASS. Product SHA `7d0bded27a624ed0d993d860cbd590262ed1f3a6` passed GitHub Actions run `33853804394`, including real Windows Tauri H+P1+P2 recovery, AUTO recovery, and Windows storage/package prerequisite jobs. Exact artifacts and digests are recorded in `docs/roadmap/evidence/W7-04.md` and `V1_EVIDENCE_LEDGER.json`.

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead. A documented production testability/reachability gap may authorize only the smallest test-only seam needed to observe the existing owner path; it does not authorize replacement product behavior.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior where Windows observation is required.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, privacy/projection system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores or observes the existing production path.
