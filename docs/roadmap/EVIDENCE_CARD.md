# V1 Evidence Card

Status: **W4-07 PASS — ACTOR MATERIALIZATION / HANDOUT / SPATIAL FALLBACK REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-07
Acceptance criterion: NPC/PC preset/custom Actor materialization, handout reveal/withdraw/reconnect, pinned content lookup, and no-provider/compatible-provider spatial behavior are fixed on the existing Campaign DM Library -> live Session path.
Production entrypoint: Campaign DM Library -> live Session Actor materialization / shared handout presentation -> Host-authoritative Session projection and spatial validation.
Existing implementation files: Existing Campaign DM Library, Session materialization/presentation, and spatial-provider production owners verified by docs/roadmap/evidence/W4-07.md; no second owner is introduced.
Existing automated tests: tests/ui/sessionImageHandoutRuntimeAdapter.test.ts plus the connected topology/continuity/Session-layer suite and the W4-07 Windows Tauri H+P1+P2 journeys.
Existing exact-SHA evidence: product SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; V1 Tauri Verification run 33636100197 / job 100267245684 (tauri-w4-07-spatial) = success; artifact SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7, artifact 9849024415, sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0.
Exact observed result: PASS. Windows H+P1+P2 verified G01 NPC quick-add, G02 PC preset quick-add, G03 validated custom JSON materialization, G04 reveal/withdraw, G05 reconnect continuity, G06 DM-only privacy, G07 Session-pinned lookup, G08 mapless spatial fallback, and G09 compatible-provider Host validation.
Inheritance check: PR #249 merged the verified tree into canonical work/v1-composite as 2ffc2004d795a350a4aa3676bcd7d4cb362f1ea1 with no file differences from verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7. PR #251 then added only docs/roadmap/evidence/W4-07.md and merged as add93e2d2a929ca97cc39bc29136ea766f858f39. No product/runtime defect was reproduced.
Smallest required change: None. W4-07 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-08.
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
