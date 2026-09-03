# V1 Evidence Card

Status: **W7-01 CLOSED — EXACTLY-ONCE AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-01
Classification: REUSE_LOCKED
Acceptance criterion: Duplicate request, duplicate event batch, reconnect catch-up, presentation replay, and durable retry behavior remain exactly-once for MP-H01~H03 without ghost Session state or mechanics reroll.
Production entrypoint: Existing Host request/event ledger and participant lifecycle, accepted Client replica cursor/ordered catch-up, connected resolution presentation queue, and durable write retry/recovery path; no second request ledger, event journal, retry coordinator, reconnect system, or presentation pipeline is authorized.
Existing automated verification: npx tsx --test tests/ui/productionParticipantLifecycle.test.ts tests/ui/productionClientReconnect.test.ts tests/ui/connectedResolutionPresentation.test.ts tests/ui/connectedDurableFailure.test.ts, followed by npm run build.
Exact observed failure: None on verification head de59dd9898dd4cf4525082f0aa623e4a86cbd74d. The existing production owners satisfy the focused W7-01 acceptance set.
Smallest authorized change: Scoped W7-01 verification workflow and evidence/current records only. No src/ or test implementation file changed.
Verification SHA: de59dd9898dd4cf4525082f0aa623e4a86cbd74d (Actions pull-request checkout c713e27a0989d8cd47761133e560afe4e93b77fc; GitHub compare reports zero changed files between verification head and synthetic checkout).
Verification: W7-01 AUTO Verification run 33718558967 / job 100532788018 = success; 12/12 focused tests PASS; production build PASS.
Artifact: 9879408309, W7-01-AUTO-c713e27a0989d8cd47761133e560afe4e93b77fc, sha256:600d6153242eb621ed6eabb32f86df1ee028d6102902b02ba88bebc410269cd3.
Closure: W7-01 PASS. Reconcile the official ledger to 76.3/100.0 (57 PASS / 15 PENDING), W7 1/8 PASS, then execute W7-02 / MP-H04~H08.
```

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
