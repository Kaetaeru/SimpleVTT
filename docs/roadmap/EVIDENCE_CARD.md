# V1 Evidence Card

Status: **W5-03 CLOSED — HOST SINGLE MUTATION PATH PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-03
Acceptance criterion: Client intent -> Host validate/resolve/commit is the single connected mutation path; no Client state write can bypass Host validation/authority or directly append authoritative Session history.
Production entrypoint: connectedSessionRuntimeAdapter role-dispatch / handleHostMessage -> connectedActionRequestPort -> registered Host ActionRequest handler -> HostSessionLedger -> Host event-batch -> ClientSessionReplica.
Existing implementation files: src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedActionRequestPort.ts; src/app/connectedSessionProtocol.ts; src/app/connectedSessionState.ts.
Existing automated tests: connected topology/continuity/Session-layer and live lifecycle suites composed into GitHub Actions UI; HostSessionLedger and ClientSessionReplica contracts are exercised through production connected-session verification.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; focused record docs/roadmap/evidence/W5-03.md merged by PR #259; GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...0ee6f493fc765ac7a617eda485392957b1874c6e is ahead-only and changes only canonical evidence/current docs plus evidence W4-07/W5-01/W5-02/W5-03.
Exact observed result: PASS. Client action-request traffic is handled only on the Host message path and is routed through the registered ActionRequest handler; unavailable routing returns an error. HostSessionLedger rejects wrong-session or stale-cursor intent, reserves before commit, rejects history drift/unreserved commit, and de-duplicates request IDs. ClientSessionReplica advances only by same-session gap-free Host event sequences and rejects conflicting/gapped history before cursor advance.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...0ee6f493fc765ac7a617eda485392957b1874c6e changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, docs/roadmap/V1_EVIDENCE_LEDGER.json, and evidence records W4-07/W5-01/W5-02/W5-03. No production source, connected runtime, tests, Tauri runner, or workflow implementation changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-03 as PASS in the official ledger/current documents and proceed to W5-04. No product-code modification is authorized.
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