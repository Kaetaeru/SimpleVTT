# Current roadmap

Updated: 2026-09-01 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not duplicate that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

Evidence tracking:

- [`V1_EVIDENCE_LEDGER.json`](V1_EVIDENCE_LEDGER.json)
- [`EVIDENCE_CARD.md`](EVIDENCE_CARD.md)

## Fixed V1 numbers

```text
10 workstreams: W0-W9
72 release gates
100 weighted points
120 multiplayer scenarios: MP-A01-MP-J08
18 legacy V1 release gates
13 required MP work issues: MP-01-MP-13
```

Initial repository audit classification:

```text
47/72 REUSE_LOCKED
14/72 VERIFY_ONLY
11/72 BUILD
61/72 existing implementation reused = 84.7%
```

These numbers classify the work; they are not completion credit. Completion credit comes only from the evidence ledger.

## Current evidence state

```text
W0: COMPLETE — 6/6 PASS
W1: COMPLETE — 8/8 PASS
W2: COMPLETE — 8/8 PASS
W3: IN PROGRESS — 2/8 PASS
Official ledger score: 32.5/100.0
PASS: 24/72
PENDING: 48/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Wave 2
Next Gate: W3-03
```

`W3-02` is PASS by inherited exact-SHA turn-lifecycle evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: the existing Phase 09 runtime orders initiative, initializes and preserves Action/Bonus Action/Reaction/movement economy, advances end-turn/begin-turn through the generic Resolver, increments rounds on wrap, refreshes the next turn from base economy, reconciles committed actions and Undo, admits new Combatants without restarting initiative, and returns to Freeform when initiative ends. Production `ProductionPlayScreen` exposes the real start/end initiative and end-turn commands. PR #201 records the focused evidence with no product runtime change. The next exact Gate is `W3-03`.

`W3-01` is PASS by inherited exact-SHA production-authority evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: production Freeform skill actions use authoritative d20 faces and Activity, ability checks delegate to the existing real resolution service, saving throws use runtime stat sources and the canonical d20 resolver, and portable Common Play d20 definitions lower through the existing generic Resolver with rename-invariant/rejection coverage. PR #199 added `evidence/W3-01.md` only and merged as `ca6b42c47409ff7096f31aeab12624336225ab8f`; no product runtime code changed.

`W2` is complete. W2-08 passed on product SHA `699c923dc50dac5ecd266ced58568d3b647850b6` (tree `449bf34d36c7975addcc2196b87a9a026d525730`) in Windows Tauri run `33470259003`, job `99738402317`, artifact `9786387605`, digest `sha256:3077663cb94c2a444046d94808c76a677c7d92de61a0576f61d5f57b8cd1172d`. Six archetypes were created through production UI, persisted, process-restarted on the same data root, and verified in rendered Full Sheet. The run reproduced and repaired one owner-path gap: Guided Create now materializes initial class tracks and standard/pact spell capacity through the existing progression calculators. W2-01 remains inherited evidence; W2-02 through W2-07 remain verified at `ef2cdf69748195bd63c0bd7eff747420811842bf`.

`W1` is complete. W1-05 through W1-08 passed the real Windows Tauri/WebDriver journey on product SHA `c0900157560ac51a745eac687eb4fff7f2580086` (tree `75f8fc64799a98c22e980dbd102a822555d8c846`), Actions run `33409861843`, job `99546422908`, artifact `9764936861`, digest `sha256:85eda3890fdbc6d28ee0e5155617082642a4e22c1e851a5c73783be59af00b23`.

W1-02 through W1-04 reused the existing Character Creator. Exact canonical verification SHA `42305b1d2a66a976b08844509a63b5999166938a` passed GitHub Actions UI run `33387465586`; no product runtime code was changed. W1-06 alone exposed a real production gap and minimally added distinct UUID identity plus durable duplicate/delete through the existing Character Library owner path; W1-05, W1-07, and W1-08 required no product-code change.

Common Play follows the active function-first direction in `../design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`: make the real behavior reachable and observable in Tauri before any broad shell/session visual redesign.

C9 Gate N is integrated into `work/v1-composite` and is no longer an active selection queue. Resolver execution checklists and older Phase/V0.9/V1 handoffs are architecture or historical evidence only.

## Execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before selecting work.
2. Start at the first non-`PASS` unblocked Gate; do not select work from an archived checklist.
3. Fill `EVIDENCE_CARD.md` before changing product code.
4. A `REUSE_LOCKED` or `VERIFY_ONLY` Gate cannot trigger product changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
5. Reuse the existing Tauri shell, stores, Resolver, transport, presentation pipeline, Party Stash, Long Rest, DM Library, and E2E harness.
6. Do not add branch-writing/self-publishing automation as the normal implementation loop.
7. Structural or protocol-only evidence cannot close rendered Windows behavior.
8. V1 closes only at `72/72`, `100.0/100.0`, `120/120`, all required legacy/MP issue closure, and one matching Windows artifact plus digest.
