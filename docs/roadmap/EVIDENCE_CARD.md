# V1 Evidence Card

Status: **W5-06 CLOSED — SHARED VISUAL DICE + COMBAT VFX PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-06
Acceptance criterion: local, Host, and remote Resolution presentation use the same VisualDice and CombatVfx projection owners so connected rendering consumes Host-authored authoritative results without a network-only dice/VFX resolver.
Production entrypoint: connectedActionRoutingAdapter Host presentation publication -> connectedResolutionPresentation action metadata -> connectedSessionRuntimeAdapter remote presentation install -> shared buildVisualDiceRoll / buildCombatVfxProfile projection owners.
Existing implementation files: src/app/diceVisuals.ts; src/app/combatVisuals.ts; src/app/connectedResolutionPresentation.ts; src/app/connectedActionRoutingAdapter.ts; src/app/connectedSessionRuntimeAdapter.ts.
Existing automated tests: tests/ui/connectedResolutionPresentation.test.ts; connected Session/presentation regression coverage composed into GitHub Actions UI.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; focused record docs/roadmap/evidence/W5-06.md merged by PR #265; GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...58a10dc1bf42dff79dd3f8035ea02bd9967d8f43 changes no src/ or tests/ files, while PR #265 adds only W5-06 focused evidence.
Exact observed result: PASS. buildVisualDiceRoll consumes the authoritative ResolutionView dice and buildCombatVfxProfile derives combat visual semantics from the same authoritative resolution/action presentation. connectedResolutionPresentation.test.ts reconstructs the remote action from the Host envelope and requires both the visual-dice output and combat-VFX profile to deep-equal the local projections. Client presentation application does not rerun mechanics.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...58a10dc1bf42dff79dd3f8035ea02bd9967d8f43 contains no src/ or tests/ changes. PR #265 adds only docs/roadmap/evidence/W5-06.md. No production source, connected runtime, rendering tests, Tauri runner, or workflow implementation changed across the inherited path.
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