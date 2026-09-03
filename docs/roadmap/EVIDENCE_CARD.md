# V1 Evidence Card

Status: **W7-04 IN PROGRESS — CURRENT-HEAD OWNER-WRITE FALSE SUCCESS REPRODUCED; MINIMAL REPAIR AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-04
Classification: REUSE_LOCKED
Acceptance criterion: Real Windows Tauri evidence must cover MP-B08 and MP-H09~H12: disconnected owner write-back settles exactly once on reconnect; Character owner write failure is explicit and never reports false shared success; failed Host Campaign write does not publish candidate shared state and exposes explicit recovery; asset/VFX/SFX load failure does not block authoritative mechanics/text completion; a slow P2 does not block H/P1 and later drains in order.
Production entrypoint: Existing Character library and Campaign library generation stores, Character/Campaign compound recovery, connected owner write-back/retry owners, production TCP session transport/outbound peer queues, existing presentation/VFX owners, and the existing scripts/run-tauri-e2e.mjs + tauri-e2e Tauri/WebDriver binary. No second persistence, retry, transport, reconnect, presentation, or E2E system is authorized.
Existing automated verification: .github/workflows/w7-04-auto.yml focused recovery owners plus src-tauri library tests cover prerequisite AUTO behavior. Existing scripts/run-tauri-e2e.mjs launches isolated real Windows Tauri Host+Client instances with separate data roots/WebDriver ports and remains the required owner path for the missing WIN observations. The focused AUTO list also runs productionHostPeerDisconnectRetirement.test.ts together with productionParticipantLifecycle.test.ts so physical peer retirement and reconnect identity rebind are regression-locked as one lifecycle path.
Existing Tauri/Windows evidence: PR #313 verified a debug_assertions + tauri-e2e-only one-shot generation-store fault marker on windows-latest, then ran the unchanged Rust library suite and built the release Windows application successfully. PR #310 was refreshed onto canonical 37784e4040f074e273deb37034990c85599a384b before the current behavior failures were reproduced.
Exact observed failure: First, PR #310 head a2e3bd0bd773c42d0d812f9859bf26c7ac16e689, GitHub Actions run 33811875390 / windows-multi-instance-recovery job 100835310388 reproduced MP-B08 reconnect failure in the real Windows Tauri H+P1+P2 path: after P1 terminated, Host session work still targeted dead peer 127.0.0.1:53899 and the relaunched P1 could not return to Player. That stale-peer defect was minimally repaired and AUTO-regression locked. Second, on the repaired current head 33d664a552c3fea51e4c04946eb0bc5666337c0f, run 33814672820 / windows-multi-instance-recovery job 100844042087 advanced past that reconnect point and reproduced the next W7-04 owner-write defect: while P1 was physically offline, the owner inventory call `grant-currency` returned normal success (`offline.ok === true`) instead of the required explicit rejection, failing assertion `offline owner write should be rejected`. This is a current-HEAD MP-B08/MP-H09 false-success production defect in the existing connected owner-inventory path.
Smallest authorized change: Preserve the existing reconnect, journal, persistence, retry, duplicate suppression, and owner-authority systems. For a Client that still belongs to a live connected session (`state.mode === client` with a sessionId), refuse direct owner inventory mutation while the app connection is not `connected`, instead of applying the durable local owner journal and reporting success. Synthetic restart reconciliation with no active sessionId must remain available. Add a focused regression proving a disconnected/reconnecting live Client cannot mutate its local Character or report success. Do not add a queue, second reconnect owner, or second persistence path. Then rerun the same W7-04 Windows H+P1+P2 acceptance.
Verification SHA: Initial reconnect failure was reproduced from PR #310 head a2e3bd0bd773c42d0d812f9859bf26c7ac16e689 against canonical base 37784e4040f074e273deb37034990c85599a384b. Focused stale-peer repair commits 49ca71f68d7e352e227916a8fa0e34486b8b4145 and 2abdf185d92f3fc08a17ffcd8d8d526ad181d50b are included in later PR heads. The current false-success owner-write failure is reproduced on PR #310 exact head 33d664a552c3fea51e4c04946eb0bc5666337c0f in run 33814672820.
Verification: On exact head 33d664a552c3fea51e4c04946eb0bc5666337c0f, run 33814672820 auto-recovery job 100844042313 PASS, including focused W7-04 recovery owners and production build; windows-multi-instance-recovery job 100844042087 FAIL only after advancing beyond the previous stale-peer reconnect failure to the explicit offline-owner-write assertion above. A new exact-head Windows run is required after the authorized owner-write repair.
Artifact: Current false-success failure artifact 9916286884 from W7-04 Windows run 33814672820 contains the real-Tauri H+P1+P2 failure evidence. Previous reconnect failure artifact 9915236457, W7-04-WIN-c89fba10cef8e7eda849a4d1d6e1045f9cdb5e01, sha256:209a66f39f3a99fc74bf2d00f4781efe5f79a0cd92347e41e357718a6a7ce14e. Earlier AUTO prerequisite artifact 9913583602, W7-04-AUTO-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:b05778ff73f8da7d5a4161791f1c5f49bcabcc72e608bfa644774c51090133fa. Earlier Windows prerequisite artifact 9913926913, W7-04-WINDOWS-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:f5c2dc92b5375520988e883abfede2c00a16409b9af9a719751bfbda6fa5880e.
Closure: W7-04 remains PENDING. Do not mark it PASS until actual real-Tauri multi-instance WIN observations for MP-B08 and MP-H09~H12 succeed and their exact-SHA evidence is recorded in the ledger.
```

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead. A documented production testability/reachability gap may authorize only the smallest test-only seam needed to observe the existing owner path; it does not authorize replacement product behavior.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores or observes the existing production path.
