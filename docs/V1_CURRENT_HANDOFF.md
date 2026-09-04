# SimpleVTT V1 Current Handoff

Updated: 2026-09-04 Asia/Seoul

This handoff is subordinate to live GitHub state, `CANONICAL_ROOT.md`, `docs/CURRENT.md`, `docs/roadmap/CURRENT.md`, `docs/roadmap/V1_MASTER_ROADMAP.md`, and `docs/roadmap/V1_EVIDENCE_LEDGER.json`. It exists to give the next execution a concise resumable checkpoint without replacing repository-native authority.

## Canonical status

```text
Integration branch: work/v1-composite
W0-W6: COMPLETE
W7: 4/8 PASS — IN PROGRESS
Official ledger score: 80.0/100.0
PASS: 60/72
PENDING: 12/72
FAIL: 0
BLOCKED: 0
Next exact Gate: W7-05
```

## Last closed Gate — W7-04

`W7-04` is PASS with authoritative real-Windows recovery evidence.

- Product verification SHA: `7d0bded27a624ed0d993d860cbd590262ed1f3a6`
- GitHub Actions run: `33853804394`
- `auto-recovery`: PASS
- `windows-multi-instance-recovery`: PASS on real Windows Tauri H+P1+P2
- `windows-storage-package`: PASS
- Scenario mapping: `MP-B08`, `MP-H09~H12`
- Evidence: `docs/roadmap/evidence/W7-04.md`

The passing path covers explicit offline-owner failure, reconnect/retry durability, partial persistence failure isolation/recovery, and slow-P2 observer convergence. Do not redo W7-04 without a demonstrated regression.

## Next exact action — W7-05

`W7-05` is `REUSE_LOCKED` and covers privacy leakage boundaries for `MP-B05~B07` and `MP-09`.

1. Start from the latest live `work/v1-composite` HEAD on one scoped `agent/*` branch.
2. Reuse the existing Session privacy/redaction, Activity visibility, projection, and handout metadata owners.
3. Identify and run the smallest exact-head focused automated set proving DM-only/hidden/private payloads, Activities, and handout metadata do not reach unauthorized peers.
4. If the focused set passes, record exact SHA, command, deterministic pass count, and scenario mapping, then close W7-05 without product/runtime changes.
5. If it fails, record the current-HEAD failure or reachability gap in `docs/roadmap/EVIDENCE_CARD.md` before making only the smallest repair.

## Guardrails

- Do not create a second privacy model, projection layer, Activity log, handout system, transport, reconnect system, or E2E framework.
- `REUSE_LOCKED`/`VERIFY_ONLY` product changes require a reproduced current-HEAD failure or explicit reachability/contract gap.
- Do not reopen completed W0-W6 or W7-01~W7-04 without a demonstrated regression.
- Final V1 closure still requires 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, MP-01~MP-13 closed, and one matching Windows release artifact plus digest from the authoritative final SHA.
