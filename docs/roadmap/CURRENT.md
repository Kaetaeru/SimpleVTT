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
W2: IN PROGRESS — 7/8 PASS
Official ledger score: 28.1/100.0
PASS: 21/72
PENDING: 51/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Wave 1
Next Gate: W2-08
```

`W2-01` remains PASS by inherited exact-SHA catalog evidence. `W2-02` through `W2-07` passed on verification SHA `ef2cdf69748195bd63c0bd7eff747420811842bf` in GitHub Actions UI run `33439392457`, job `99643608987`: 89 focused lifecycle tests passed, the 339-spell presentation/execution catalogs were fixed, all 36 Common Play mechanism families were Gate-N-ready, the legacy execution boundary passed, and the full production build passed. The verification commit changes only the existing workflow from integration parent `60586e1871abea954d80f68cfb062b9ad1071b68`; product code is unchanged. The next exact Gate is `W2-08`, which requires rendered Windows/Tauri evidence for six representative archetypes.

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
