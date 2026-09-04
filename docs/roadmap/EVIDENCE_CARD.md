# V1 Evidence Card

Status: **W7-05 IN PROGRESS — CURRENT-HEAD PRIVACY CONTRACT GAP REPRODUCED; MINIMAL REPAIR AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-05
Classification: REUSE_LOCKED -> contract/reachability gap -> focused repair authorized
Acceptance criterion: DM-only, hidden, and private payloads, Activities, and handout metadata must not leak to unauthorized peers. Canonical scenario mapping: MP-B05~B07 and MP-09. MP-B05 requires H to retain private Activity detail while P1/P2 receive only the permitted public projection; MP-B06 requires hidden roll/target facts to omit both raw values and inferable metadata from unauthorized Clients; MP-B07 requires one new ordered disclosure event that reveals only the selected result.
Production entrypoint: Reuse the existing connected Session ledger/transport, connected resolution presentation path, connected Action routing, Client projection application, Activity log, and handout projection path. Do not add a second privacy model, projection layer, Activity log, handout system, transport, request/event ledger, or Session authority path.
Existing automated verification: tests/ui/connectedResolutionPresentation.test.ts proves the existing public envelope strips private interrupt response controls and action details/resourceCost; tests/ui/connectedThreePeerPresentation.test.ts proves identical ordered public fan-out to acting/observing Clients; tests/ui/sessionImageHandoutRuntimeAdapter.test.ts covers reveal/withdraw/reconnect/privacy/pinned lookup; tests/ui/campaignDmLibraryNoteStructure.test.ts and campaignDmLibraryStructure.test.ts prove DM Library note/private metadata does not enter Session projection. These are useful B05/handout prerequisites but do not establish B06 hidden-roll/hidden-target or B07 selective disclosure.
Existing Tauri/Windows evidence: MP-09 issue #122 explicitly requires deterministic AUTO evidence and Windows H+P1+P2 evidence for its assigned privacy scenarios. No exact-head W7-05 Windows H+P1+P2 evidence exists yet. Any focused WIN observation must extend the existing Tauri/WebDriver runner rather than create a second E2E framework.
Exact observed failure: On canonical exact SHA 191511c209ae14ac1a7dc55529662b57c656576c, the connected privacy contract cannot represent MP-B06 or MP-B07. src/app/connectedResolutionPresentation.ts defines ConnectedResolutionPresentationV1.audience only as {scope:"public"}; buildConnectedResolutionPresentation always copies resolution.targetIds into public targets and authoritativeDice into public dice.faces. ResolutionView/presentation construction has no hidden-roll/hidden-target audience marker that could suppress those facts for unauthorized peers. src/app/connectedSessionProtocol.ts ConnectedEventPayload contains resolution, mode-transition, correction, participant, scene-topology, resolution-undo, and ready-action variants only; it has no ordered privacy/disclosure event that can reveal exactly one selected hidden result later. Therefore a DM-hidden roll/target cannot be represented without leaking its raw/inferable metadata, and the required later disclosure event cannot be emitted through the current production protocol. Existing private interrupt/concentration prompt routing and handout/DM-note privacy are only partial B05 prerequisites and do not satisfy B06/B07.
Smallest authorized change: Extend the existing connected resolution publication/projection contract rather than introduce a parallel privacy system. Add the minimum Host-owned visibility/audience fact needed to build a redacted public presentation for hidden roll/target data, keep private detail on H, and add one ordered ledger event on the existing ConnectedEventPayload/HostSessionLedger path for selective later disclosure. Reuse the current broadcast/sendTo transport and Activity application path. First add focused deterministic MP-B05~B07 tests, then run them plus existing handout/DM-note privacy owners; after AUTO passes, extend the existing Tauri/WebDriver multi-instance runner with only the smallest W7-05 H+P1+P2 privacy observation required by issue #122.
Verification SHA: 191511c209ae14ac1a7dc55529662b57c656576c (canonical work/v1-composite before any W7-05 repair).
Verification: Static exact-SHA contract inspection plus existing focused owner inspection reproduced a production reachability/contract gap before product modification. connectedResolutionPresentation.ts exposes one public audience and always serializes target IDs/dice; connectedSessionProtocol.ts exposes no selective disclosure payload. No W7-05 PASS or Windows observation is claimed by this card.
Artifact: None. This card records the exact-head authorization gap; executable AUTO/WIN evidence remains required after repair.
Closure: W7-05 remains PENDING. Product/runtime repair is now authorized only for the minimal existing connected presentation/protocol path described above; the Gate may close only after deterministic AUTO plus required Windows H+P1+P2 privacy evidence and scenario mapping are recorded in V1_EVIDENCE_LEDGER.json.
```

## Previous Gate closure

`W7-04` is PASS. Product SHA `7d0bded27a624ed0d993d860cbd590262ed1f3a6` passed GitHub Actions run `33853804394`, including real Windows Tauri H+P1+P2 recovery, AUTO recovery, and Windows storage/package prerequisite jobs. Exact artifacts and digests are recorded in `docs/roadmap/evidence/W7-04.md` and `V1_EVIDENCE_LEDGER.json`.

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead. A documented production testability/reachability gap may authorize only the smallest test-only seam needed to observe the existing owner path; it does not authorize replacement product behavior.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior where Windows observation is required.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, privacy/projection system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores or observes the existing production path.

## Parallel card — W7-07 (MP-I02 production entrypoint gap)

```text
Gate ID: W7-07
Classification: REUSE_LOCKED -> MP-I02 has no production entrypoint -> smallest test-observable seam authorized
Acceptance criterion: keyboard, screen reader, narrow desktop, Reduced Motion, and correlated diagnostics are fixed for MP-I01~I06; MP-I02 requires one coherent screen-reader announcement of actor/action/targets/dice/total/outcome/state change.
Production entrypoint: existing Session result layer (SessionResolutionLayer in src/SessionModeRoot.tsx), already a role="status" live region; existing production dice/VFX, keyboard focus, responsive, and Activity owners.
Existing automated verification: productionPlayWorkspaceAccessibility, sessionResponsiveKeyboardFocusStructure, visualDiceStructure, physicsDice3DStructure, connectedThreePeerPresentation, connectedThreePeerDuplicateEventBatch, session_transport Rust intake tests; new connectedDiagnosticCorrelation (MP-I06, observes existing Activity ids only).
Existing Tauri/Windows evidence: none for W7-07; the Windows representative accessibility case is routed to W7-08 by the roadmap.
Exact observed failure: on the integration HEAD after PR #319 the result layer announces actor·action, outcome/total, and state summary but never the target names or authoritative dice faces, so MP-I02's single coherent announcement cannot be produced by any existing element.
Smallest authorized change: add one visually-hidden sentence inside the existing status live region (both active and passive-remote variants) composed only from the ResolutionView already rendered, and mark the visible copy aria-hidden so it is not read twice. No new component, store, or presentation path.
Verification SHA: PENDING (branch agent/w7-06-07-capability-accessibility-auto from 1fa84f7a5c2a4c2b).
Verification: sessionResolutionAnnouncementStructure.test.ts pins the seam; W7-07 AUTO workflow records the exact-SHA run.
Artifact: W7-07-AUTO-<verification sha>.
Closure: W7-07 remains PENDING until the W7-07 AUTO run (both jobs) passes on one integration-derived SHA and is recorded in V1_EVIDENCE_LEDGER.json.
```

