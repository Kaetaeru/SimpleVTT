# V1 Evidence Card

Status: **W6-05 CLOSED — MP-E14 CAPABILITY-DRIVEN ITEM-TO-RATIONS AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-05
Classification: REUSE_LOCKED
Acceptance criterion: Freeze the existing capability-driven item-to-rations path for MP-E14 so eligibility comes from trusted capability data and source-item debit plus Campaign ration credit commit atomically through the existing Campaign transaction owner.
Production entrypoint: Existing Campaign Ration Conversion panel/runtime adapter, Party Stash capability catalog, Campaign ration ledger, and mutateCampaign transaction path; no parallel conversion table, second inventory model, or replacement ration store is authorized.
Existing automated tests: tests/ui/campaignRationConversion.test.ts; tests/ui/campaignRationConversionRuntime.test.ts; tests/ui/campaignRationConversionLegacyStash.test.ts; tests/ui/campaignRationConversionProductionStructure.test.ts.
Exact observed failure: None on integration-derived exact verification SHA 945188901c106b6114e3a7f89cb1671aab6ace27 (base 52b6fc06b114768903887de3669f6499172afb72). Canonical push verification passed the focused ration-conversion suite and production build.
Smallest authorized change: No product/runtime or test-implementation change. Add the focused workflow and record exact-SHA evidence only.
Verification SHA: 945188901c106b6114e3a7f89cb1671aab6ace27
Verification: W6-05 AUTO Verification run 33711448138 / job 100511627712 = success; 9/9 focused tests PASS; production build PASS.
Artifact: 5808814072, W6-05-AUTO-945188901c106b6114e3a7f89cb1671aab6ace27, sha256:26ce88561019490d1c8734cb838ebf6dd789c180e9e4af57974a2559439351dc.
Closure: W6-05 PASS. Reconcile the official ledger to 71.3/100.0 (53 PASS / 19 PENDING), then open W6-06 under the same evidence-first rule. Real H + P1 + P2 Windows rendered acceptance remains later.
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
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
