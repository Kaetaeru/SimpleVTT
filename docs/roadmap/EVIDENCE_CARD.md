# V1 Evidence Card

Status: **W5-06 CLOSED — SHARED VISUAL DICE / COMBAT VFX PATH PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-06
Acceptance criterion: Local, Host, and remote authoritative Resolution presentation use the same shared visual-dice and combat-VFX projection owners; remote Clients reproduce Host-authored presentation metadata without rerunning mechanics.
Production entrypoint: connectedActionRoutingAdapter / connectedResolutionPresentation -> shared buildVisualDiceRoll in src/app/diceVisuals.ts + buildCombatVfxProfile in src/app/combatVisuals.ts -> VisualDiceBridge + CombatVfxBridge.
Existing implementation files: src/app/diceVisuals.ts; src/app/combatVisuals.ts; src/app/connectedResolutionPresentation.ts; src/app/connectedActionRoutingAdapter.ts; src/app/connectedSessionRuntimeAdapter.ts.
Existing automated tests: tests/ui/connectedResolutionPresentation.test.ts; connected Session/presentation regression coverage composed into GitHub Actions UI.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; focused record docs/roadmap/evidence/W5-06.md merged by PR #265; GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...58a10dc1bf42dff79dd3f8035ea02bd9967d8f43 is ahead-only and contains no src/ or tests/ changes.
Exact observed result: PASS. The authoritative local path and remote Host-authored presentation both project through buildVisualDiceRoll and buildCombatVfxProfile; the focused regression proves equal local/remote dice and VFX projections and no Client mechanics rerun.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...58a10dc1bf42dff79dd3f8035ea02bd9967d8f43 contains only canonical evidence/current documents and prior evidence records before PR #265; PR #265 adds only docs/roadmap/evidence/W5-06.md. No production source, connected runtime, tests, Tauri runner, or workflow implementation changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-06 as PASS in the official ledger/current documents and proceed to W5-07. No product-code modification is authorized.
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