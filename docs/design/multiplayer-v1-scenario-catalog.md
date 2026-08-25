# SimpleVTT V1 Multiplayer Completion Scenario Catalog

Status: **CANONICAL FINAL V1 OBJECTIVE**

Owner decision: 2026-08-23. The scenarios in this catalog are required V1 release scope, not an optional post-V1 follow-up.

This document is the canonical, implementation-facing scenario inventory for declaring SimpleVTT V1 multiplayer complete. It supplements, but does not replace, `session-runtime.md`, `combat-ux.md`, `DICE-PRESENTATION.md`, the UI behavior contracts, and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`.

## 1. Release claim

V1 multiplayer is complete only when every applicable scenario below passes both its automated gate and the Windows multi-instance acceptance gate. Protocol convergence alone is not sufficient. A remote participant must observe the same public action, authoritative dice, result, state change, and activity outcome at the appropriate time.

The required topology is:

- `H`: authoritative Host/DM application.
- `P1`: owning Player who initiates an action.
- `P2`: another connected Player who observes the action.
- `P3`: late-joining or reconnecting Player used for catch-up checks.

At least one release run must use `H + P1 + P2`. Scenarios involving catch-up additionally use `P3` or restart one of the existing clients.

## 2. Global acceptance invariants

Every shared mutation or presentation must satisfy all applicable invariants.

1. **Host authority**: Clients submit intents. Only Host validation/resolution creates canonical shared outcomes.
2. **Single mechanics result**: Physics, animation, optimistic UI, retries, and reconnect never roll or resolve the rule a second time.
3. **Live fan-out**: H, P1, and P2 receive one ordered public outcome. Role-private projections may intentionally differ.
4. **Presentation parity**: Every live peer permitted to see an outcome receives the same action identity, actor, targets, authoritative dice faces, selected/discarded dice, total, outcome, damage/healing/effect summary, and terminal state.
5. **Timeline semantics**: Minor network delay is allowed, but peers preserve the same causal order. A later action must not visually overtake an earlier committed action.
6. **State convergence**: Scene, Character-owned runtime state, Campaign-owned state, and Activity converge to their authoritative values.
7. **Exactly once**: Duplicate requests, duplicate event batches, and reconnect replay do not double-apply state or replay a completed cinematic as a new live action.
8. **Ownership**: Only the owning Client writes its Character library; only Host writes Campaign state.
9. **Privacy**: DM-only facts, notes, hidden rolls, and private handout state never leak through payloads, logs, accessibility labels, errors, or reconnect history.
10. **Durability**: Acknowledgement loss, process restart, and partial persistence failure recover or compensate without item/GP/resource duplication.
11. **Accessibility**: Reduced Motion changes motion, not the authoritative result or information. Text results remain available without relying on 3D dice.
12. **Explicit failure**: Incompatible content, stale revision, invalid ownership, missing capability, and persistence failure produce actionable terminal or retryable UI instead of silent divergence.
13. **One presentation pipeline**: Local, Host, acting Client, and observing Client reuse the same shared dice and combat-VFX projection/rendering paths. Network code transports authoritative presentation data; it does not introduce a second VFX implementation or per-spell hardcoded renderer.

## 3. Shared presentation contract

A committed shared resolution needs an immutable presentation envelope in addition to domain `ResolutionEvent[]`. The exact schema is an implementation decision, but every consuming Client must be able to render, without running mechanics locally:

- session/event/resolution IDs and ordered cursor;
- actor ID and public actor label;
- action ID, public action label, action family, and icon intent;
- target IDs and public target labels;
- stage/timeline identity and whether presentation is live, resumed, or catch-up-only;
- structured authoritative dice, die purpose, selected/discarded status, modifiers, totals, DC/AC when public, and result tier;
- attack/check/save/spell/item/healing/damage/effect summaries;
- public VFX/SFX cues and result-card content;
- privacy scope and redacted public alternative;
- state-change summary and Activity linkage;
- reduced-motion-compatible timing data, not simulation-derived mechanics.

Catch-up must normally apply final state and Activity without replaying old full-screen dice as if they just occurred. A reconnect that happens during an active presentation may resume at a bounded current stage or collapse directly to the committed result; it must never reroll.

The shared combat VFX path is `buildCombatVfxProfile` -> `CombatVfxBridge` -> the common renderer/styles. Multiplayer work must feed this path from the authoritative presentation envelope. Replacing the renderer must replace it for local, Host, acting Client, and observing Client together.

## 4. Scenario catalog

Each scenario must be represented by an executable test or a clearly named Windows acceptance case. `AUTO` means deterministic automated coverage is required. `WIN` means real desktop instances are required. Most completion scenarios require both.

### A. Session topology and lifecycle

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-A01 | Host creates a Campaign-bound Session | H binds immutable Campaign/session capabilities; no mock connection is reported | AUTO, WIN |
| MP-A02 | P1 joins with a Host-unknown persisted Character | H mounts only a trusted ephemeral projection; P1 retains Character ownership | AUTO, WIN |
| MP-A03 | P2 joins the same live Session | H/P1/P2 participant lists converge without replacing P1 projection | AUTO, WIN |
| MP-A04 | Join without a valid Character | Join is blocked before a partial actor/projection is published | AUTO, WIN |
| MP-A05 | Protocol/rules/content capability mismatch | Incompatible peer is rejected with an actionable reason and no shared mutation | AUTO, WIN |
| MP-A06 | Ready and Session start | readiness and start state fan out once; Session mode/round/current actor converge | AUTO, WIN |
| MP-A07 | Player leaves normally | participant/actor lifecycle follows the declared policy and does not delete durable Character data | AUTO, WIN |
| MP-A08 | Host ends Session explicitly | all Clients enter ended state; pending transient workflows are closed; summary persists to Campaign | AUTO, WIN |
| MP-A09 | Host restarts after Session end | stale participants, projections, Ready actions, turns, approvals, and presentations do not return | AUTO, WIN |
| MP-A10 | Navigate Product shell while Session remains live | connection and Session state remain mounted and Return to Play restores the same runtime | AUTO, WIN |

### B. Ownership, projection, and visibility

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-B01 | Character source/runtime projection | trusted identity, HP, AC, speed, resources, items, spells, and features reconstruct on H | AUTO |
| MP-B02 | Client presentation values are tampered | H ignores untrusted derived values and reconstructs from trusted rules/content | AUTO |
| MP-B03 | P1 acts with its projected Character | H temporarily activates P1 context and restores H context after completion/error | AUTO, WIN |
| MP-B04 | H controls NPC/PC-preset Actor | control changes do not transfer Character ownership or turn authority | AUTO, WIN |
| MP-B05 | Public and DM-only Activity | H sees private detail; P1/P2 receive only the permitted public projection | AUTO, WIN |
| MP-B06 | Hidden roll or hidden target fact | unauthorized Clients receive neither raw value nor inferable metadata | AUTO, WIN |
| MP-B07 | Later DM disclosure | one new disclosure event reveals only the selected result and keeps history ordered | AUTO, WIN |
| MP-B08 | Client disconnects while owning Character state changes | H retains canonical Session state; owner write-back settles on reconnect exactly once | AUTO, WIN |

### C. Authoritative actions, dice, and cross-client presentation

All C scenarios are incomplete until P2 observes the same permitted live presentation, not merely the final state.

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-C01 | P1 performs an attack against an NPC | H resolves once; H/P1/P2 show actor, target, d20, modifiers, hit/miss, damage, HP result, VFX, and Activity | AUTO, WIN |
| MP-C02 | NPC attacks P1 | H/P1/P2 show the same public attack; P1 receives any owner-specific response UI | AUTO, WIN |
| MP-C03 | P1 attacks P2 | target owner and observer see identical public resolution; only P2 Character library writes P2-owned state | AUTO, WIN |
| MP-C04 | Attack misses | no damage is applied; miss presentation/result card agree on all peers | AUTO, WIN |
| MP-C05 | Critical or other result tier | selected face/tier and damage dice semantics agree on all peers | AUTO, WIN |
| MP-C06 | Advantage/disadvantage-like attack | all rolled faces and selected/discarded dice are consistent across peers | AUTO, WIN |
| MP-C07 | Multi-die damage | die shapes, damage groups/types, flat modifiers, total, and target HP converge | AUTO, WIN |
| MP-C08 | Ability check | H/P1/P2 show the same authoritative d20, skill/ability, proficiency, total, and public outcome | AUTO, WIN |
| MP-C09 | Saving throw | requester/roller distinction, DC visibility, die, total, and result are role-correct | AUTO, WIN |
| MP-C10 | Influence/Search/Study picker action | selected skill intent reaches H and the resulting check is presented to every permitted peer | AUTO, WIN |
| MP-C11 | No-target or self action | no phantom target is created; resource/state result and presentation fan out | AUTO, WIN |
| MP-C12 | Single-target spell attack | attack roll, spell identity, target, damage/effect, slot/resource use, and Activity converge | AUTO, WIN |
| MP-C13 | Saving-throw spell | each target result is associated with the correct target; public/private DC policy is honored | AUTO, WIN |
| MP-C14 | Multi-target/area-like spell in mapless Core | explicit target set is authoritative; per-target results remain ordered and readable | AUTO, WIN |
| MP-C15 | Cantrip | no slot is consumed; authoritative dice and result still fan out | AUTO, WIN |
| MP-C16 | Slotted spell | slot consumption writes only once and is visible to the owning Character | AUTO, WIN |
| MP-C17 | Healing action/spell/item | healing dice/flat arithmetic, cap behavior, HP, resource/item cost, and presentation agree | AUTO, WIN |
| MP-C18 | Consumable item | item identity/charges/quantity and effect resolve once; owner inventory persists once | AUTO, WIN |
| MP-C19 | Feature/resource action | declared resource cost and resulting effect converge and are visible in Quick/Full Sheet | AUTO, WIN |
| MP-C20 | Unsupported/disabled action | reason is explicit; no roll, cinematic, event commit, or resource debit occurs | AUTO, WIN |
| MP-C21 | Invalid target | invalid target is rejected before mechanics/presentation; other peers see no false action | AUTO, WIN |
| MP-C22 | Concurrent P1 and P2 intents | H establishes one canonical order; each action resolves/presents without overwrite | AUTO, WIN |
| MP-C23 | Duplicate action request | prior committed event is returned; state and live cinematic are not duplicated | AUTO, WIN |
| MP-C24 | Client receives duplicate event batch | cursor/state/Activity remain exactly once; completed dice do not replay | AUTO |
| MP-C25 | Observer opens Sheet/utility during a roll | body-level presentation remains visible/readable and does not corrupt focus/layer state | AUTO, WIN |
| MP-C26 | Reduced Motion peer observes shared roll | same result and text appear with reduced/short motion; other peers may retain full motion | AUTO, WIN |
| MP-C27 | Dice physics visual contract | dice enter from behind camera, travel in depth, land/roll/collide, remain on-screen, settle, and display the authoritative faces | STRUCTURE, WIN |
| MP-C28 | Zero-dice or aggregate-only legacy result | no fake physical dice are invented; explicit result fallback is shared | AUTO, WIN |
| MP-C29 | Presentation interruption by a newer event | queue preserves commit order; terminal result remains inspectable | AUTO, WIN |
| MP-C30 | Activity expansion after presentation | calculation detail matches the immutable committed resolution on H/P1/P2 | AUTO, WIN |

### D. Initiative, reactions, interrupts, and corrections

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-D01 | Start Initiative | order, round, current actor, Actor boards, and Command Center converge | AUTO, WIN |
| MP-D02 | Advance/end turn | turn/economy changes precede later actions and are exactly once | AUTO, WIN |
| MP-D03 | Off-turn prohibited action | Client sees explicit disabled reason; H commits nothing | AUTO, WIN |
| MP-D04 | Reaction/interrupt prompt | only eligible owner receives the private decision; public waiting state reveals no private option detail | AUTO, WIN |
| MP-D05 | Reaction accepted | original resolution resumes with the authoritative reaction result; all public timelines converge | AUTO, WIN |
| MP-D06 | Reaction declined/timed out | original resolution resumes once with a declared terminal response | AUTO, WIN |
| MP-D07 | Concentration response | owner response and resulting public state are correctly separated and ordered | AUTO, WIN |
| MP-D08 | Ready Action armed | configuration/economy/state fan out; reconnect restores final armed state | AUTO, WIN |
| MP-D09 | Ready Action triggered | trigger action uses H authority, shares full presentation, and clears Ready exactly once | AUTO, WIN |
| MP-D10 | Ready cleared at next own turn | turn event precedes actor-specific Ready clear; reconnect sees cleared state | AUTO, WIN |
| MP-D11 | Ready cleared when Initiative ends | all affected actors clear deterministically; no stale configuration survives | AUTO, WIN |
| MP-D12 | DM correction/undo | correction is a new compensating event; state and Activity converge without erasing history | AUTO, WIN |
| MP-D13 | Correction during/after presentation | original result remains historical; correction does not mutate already shown dice into different dice | AUTO, WIN |

### E. Inventory, currency, XP, and Party Stash

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-E01 | DM grants catalog/custom item to P1 | H authorizes; P1 owner library and all permitted Session projections converge | AUTO, WIN |
| MP-E02 | DM revokes item | equipped/wielded/attuned policy is explicit; forced transition is deliberate and durable | AUTO, WIN |
| MP-E03 | DM grants/revokes GP | overdraft is rejected; requested amount and final balance converge | AUTO, WIN |
| MP-E04 | DM grants XP to one/multiple Characters | exact XP is durable and visible; no reason is required | AUTO, WIN |
| MP-E05 | DM grants immediate level-up credit | eligible owner can complete level-up in Session using canonical Character persistence | AUTO, WIN |
| MP-E06 | P1 deposits item into Party Stash | owner debit and Campaign credit are atomic/idempotent; P2 sees updated shared stash | AUTO, WIN |
| MP-E07 | P1 withdraws item under shared policy | Campaign debit and owner credit settle once; arrow direction and quantity are correct | AUTO, WIN |
| MP-E08 | Deposit/withdraw GP | exact amount moves once and owner+Stash total GP is conserved; insufficient funds reject without partial mutation; a post-commit journal/finalize failure cannot roll back only the owner debit | AUTO, WIN |
| MP-E09 | Custom/charged item round-trip | full item instance/template/charges/provenance survive Stash transfer | AUTO, WIN |
| MP-E10 | DM-approval withdrawal | request causes no mutation before approval; committed/rejected/cancelled outcomes reach requester | AUTO, WIN |
| MP-E11 | DM-managed policy | unauthorized Player mutation is blocked and DM operation remains available | AUTO, WIN |
| MP-E12 | Persistence failure during transfer | exact compensation restores both owners; retry cannot duplicate assets | AUTO, WIN |
| MP-E13 | Lost acknowledgement/restart during transfer | coordinator/journal recovery reaches one terminal result | AUTO, WIN |
| MP-E14 | Item converted to rations | eligibility comes from capability data; item debit and ration credit are atomic | AUTO, WIN |

### F. Campaign systems and rest

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-F01 | DM edits era/date/time during Session | H commits structured time; permitted Clients see the same calendar and detailed day period | AUTO, WIN |
| MP-F02 | Advance time across day/month/year boundary | deterministic calendar conversion and Activity/history converge | AUTO, WIN |
| MP-F03 | Calendar disabled | values are preserved; automation is disabled with an explanation; Session play continues | AUTO, WIN |
| MP-F04 | Ration visibility public/hidden | public Clients see allowed totals; hidden mode leaks no balance/need/shortage metadata | AUTO, WIN |
| MP-F05 | Consume rations/advance day | preview and compound commit use one authoritative Campaign transaction | AUTO, WIN |
| MP-F06 | Ration shortage | warning data converges; no undeclared Character consequence is invented | AUTO, WIN |
| MP-F07 | Long Rest success | eligible owner Characters recover through declared rules while optional time/rations commit atomically | AUTO, WIN |
| MP-F08 | Long Rest rejected/preflight failure | no Character or Campaign generation partially advances | AUTO, WIN |
| MP-F09 | Long Rest disconnect/restart recovery | distributed transaction settles/compensates exactly once after owner/Host restart | AUTO, WIN |
| MP-F10 | Declarative calendar/ration provider | exact pinned compatible provider drives H; missing/incompatible provider blocks only dependent mutation | AUTO, WIN |

### G. DM live content and presentation tools

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-G01 | DM Library NPC quick-add | Campaign-private definition materializes a public Session Actor without exposing private source metadata | AUTO, WIN |
| MP-G02 | DM Library PC preset quick-add | Campaign-owned preset becomes a DM-controlled Actor, never a Player-owned Character | AUTO, WIN |
| MP-G03 | Custom JSON item/NPC/image definition | validated fields survive materialization; invalid executable/unsafe data rejects | AUTO, WIN |
| MP-G04 | Image/handout reveal | H preview stays private; reveal reaches P1/P2 with correct layer; withdraw removes it | AUTO, WIN |
| MP-G05 | Reconnect during active handout | permitted active reveal is restored without leaking withdrawn/private assets | AUTO, WIN |
| MP-G06 | DM-only note/folder/search | no note text, existence metadata, tag, favorite, or index leaks to Clients | AUTO, WIN |
| MP-G07 | Rules/content lookup during live Session | lookup is local presentation over the pinned Session content snapshot | AUTO, WIN |
| MP-G08 | Optional spatial provider absent | distance/out-of-range mechanics remain disabled; ranged target is not falsely rejected | AUTO, WIN |
| MP-G09 | Compatible spatial provider present | provider facts include provenance and H alone validates dependent mechanics | AUTO, WIN |

### H. Recovery, ordering, and failures

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-H01 | P2 disconnects before an action | H/P1 continue; P2 catches up to final state/Activity without stale live cinematic | AUTO, WIN |
| MP-H02 | P2 disconnects during dice presentation | reconnect never rerolls; it resumes bounded presentation or shows final result by policy | AUTO, WIN |
| MP-H03 | P1 disconnects after intent before commit | H reaches one terminal request state; retry is idempotent | AUTO, WIN |
| MP-H04 | H disconnects/crashes during pending action | Clients show explicit recovery state; no Client self-promotes or resolves locally | AUTO, WIN |
| MP-H05 | H restarts with durable Campaign state | authoritative durable state recovers; transient presentation/approval/interrupt state follows explicit policy | AUTO, WIN |
| MP-H06 | P3 late-joins after several actions | final state and permitted Activity catch up in order; old full cinematics do not flood the screen | AUTO, WIN |
| MP-H07 | Event gap/conflicting history | Client rejects the batch and requests recovery; it does not partially apply later events | AUTO |
| MP-H08 | Stale Client cursor/revision | H rejects or catches up before accepting a new intent | AUTO, WIN |
| MP-H09 | Character owner write failure | request reports retryable/terminal status and avoids false shared success | AUTO, WIN |
| MP-H10 | Campaign write failure | candidate shared state is not published; compensation/retry is explicit | AUTO, WIN |
| MP-H11 | Asset/VFX/SFX load failure | mechanics and text result still complete; failure does not block authoritative state | AUTO, WIN |
| MP-H12 | Slow peer | slow P2 does not block H/P1; P2 preserves order when draining its queue | AUTO, WIN |

### I. Accessibility, responsiveness, and observability

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-I01 | Keyboard-only action and response | focus order, target selection, interrupt response, result inspection, and Escape layering work | AUTO, WIN |
| MP-I02 | Screen-reader result | actor/action/targets/dice/total/outcome/state change have one coherent announcement | AUTO, WIN |
| MP-I03 | Narrow desktop | Actor boards, action bar, utilities, result, and reconnect controls remain reachable | AUTO, WIN |
| MP-I04 | Mixed peer motion preferences | shared mechanics remain identical while each peer uses its local motion preference | AUTO, WIN |
| MP-I05 | Presentation performance | a multi-die shared roll does not freeze network intake or lose later ordered events | AUTO, WIN |
| MP-I06 | Diagnostic correlation | H/P1/P2 logs correlate session/event/request/resolution IDs without logging private payloads | AUTO, WIN |

### J. Cross-client Session UI parity

These scenarios are screen contracts, not protocol-only checks. Except for controls that are deliberately role-scoped, the Host and owning Client must derive the same visible Character state from one accepted owner projection. Every automated case compares the UI-facing values after the full connected handshake and again after each mutation.

| ID | Scenario | Required observations | Gate |
| --- | --- | --- | --- |
| MP-J01 | Owner joins and both peers open the Session | H and P1 show the same public Actor roster; production fixture NPCs do not survive on only one peer | AUTO, WIN |
| MP-J02 | H selects P1 while P1 selects its own Actor | Actor name, HP/max/temp HP, AC, status, initiative, distance, turn economy, and legal target identity agree | AUTO, WIN |
| MP-J03 | Both peers open the selected Character action bar | executable action IDs, labels, categories, economy, targeting, availability, formulas, costs, and mechanical details agree; only role-authorized controls and owner-source versus Host-authority citation labels may differ | AUTO, WIN |
| MP-J04 | Both peers open inventory before any DM mutation | item instance identity, localized label, quantity, equipment/wield/attunement/charge state, and GP agree on first render; owner-source and Host-authority provenance labels may deliberately differ | AUTO, WIN |
| MP-J05 | DM grants/revokes GP and retries the same request | P1 UI refreshes from the transport mutation without manual reload; P1 durable Character, H inventory pane, and H Actor projection converge exactly once; serialized command or inventory item key order cannot change journal identity or recovery state | AUTO, WIN |
| MP-J06 | DM grants/revokes catalog or custom item | H/P1 inventory cards and any item-derived action refresh together; undo returns both screens to the prior state | AUTO, WIN |
| MP-J07 | Scene Actor is added/removed or owner reconnects | roster, selection fallback, current Actor, action ownership, and inventory ownership converge without stale fixture/action cards | AUTO, WIN |
| MP-J08 | Turn, resolution, correction, and reconnect checkpoints | H/P1/P2 UI-facing Actor, action, resource, inventory, Activity, dice/result, and VFX-envelope snapshots agree after every public checkpoint | AUTO, WIN |

The minimum automated UI-parity fingerprint is: public Scene entity fields; Session mode/round/current Actor/economy; selected Character action definitions; owner inventory/GP/items; active resolution presentation; and public Activity state changes. A test that asserts only a wire message, return status, or persistence record does not satisfy an MP-J gate.

Automated evidence map:

- J01-J06 and E08: `tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts` performs the real hello/hello-ack flow, requires a Client snapshot publication after remote GP mutation, compares Host/owner UI fingerprints before and after direct grants/undo/Stash compensation/retry, and proves owner+Stash GP conservation even when post-commit journal finalization fails.
- J07: `tests/ui/connectedSceneTopologyProjection.test.ts`, `tests/ui/connectedSceneTopologyHostMutation.test.ts`, and `tests/ui/productionHostRemoteFixtureIdentityProjection.test.ts` cover authoritative add/remove and fixture cleanup.
- J08: `tests/ui/connectedThreePeerActionMatrix.test.ts`, `tests/ui/connectedThreePeerPresentation.test.ts`, `tests/ui/connectedTurnProjection.test.ts`, and `tests/ui/connectedUndoCompensation.test.ts` cover public turn/resolution/presentation checkpoints. Windows visual evidence remains required for the rendered motion/VFX portions.
- Native H+P1 smoke and the J05/E08 GP path: double-click `Run SimpleVTT Tauri UI Test.cmd` (or run `npm run test:e2e:tauri`). The harness builds a feature-gated automation-only Tauri binary in `.live-dev/tauri-e2e-target`, starts two isolated Host/Client profiles, connects them over `127.0.0.1`, performs real button/input actions, grants 40 GP, deposits 10 GP, and requires both the Client inventory and Host owner-inventory UI to show 30 GP while Party Stash shows 10 GP. It explicitly rejects the observed triple-debit result of 10 GP. Screenshots and rendered UI text are written under `.live-dev/tauri-e2e/<run>/artifacts`; a protocol-only pass does not satisfy this gate.

Run the focused gate with `pnpm test:connected-ui`. The broader connected regression is every `tests/ui/connected*.test.ts` file and remains a required pre-acceptance gate.

## 5. GitHub issue plan

Create one tracking epic and the following implementation issues. Every issue must link the scenario IDs it owns, list automated tests, and list its Windows evidence artifact.

| Order | Proposed issue | Owns |
| --- | --- | --- |
| 0 | `[MP-EPIC] V1 multiplayer observable-completion` | all scenarios and release status |
| 1 | `[MP-01] Freeze shared Resolution Presentation Envelope` | invariants 1-9; C presentation schema; privacy/redaction |
| 2 | `[MP-02] Client remote presentation queue and body-level dice replay` | C01-C30, H01-H02, H06, I04-I05 |
| 3 | `[MP-03] Three-peer authoritative action matrix` | B03, C01-C24 |
| 4 | `[MP-04] Initiative, reaction, Ready, and correction fan-out` | D01-D13 |
| 5 | `[MP-05] Inventory, GP, XP, level-up, and Party Stash convergence` | E01-E14 |
| 6 | `[MP-06] Calendar, rations, providers, and distributed Long Rest` | F01-F10 |
| 7 | `[MP-07] DM Library, Actor materialization, handout, and spatial capability` | G01-G09 |
| 8 | `[MP-08] Reconnect, late join, exactly-once, and durable recovery` | A07-A09, B08, H01-H12 |
| 9 | `[MP-09] Role privacy, hidden outcomes, and capability security` | A05, B01-B07, G06-G09 |
| 10 | `[MP-10] Multiplayer accessibility, responsive UI, and diagnostics` | C25-C30, I01-I06 |
| 11 | `[MP-11] Automated H+P1+P2 acceptance harness` | executable cross-client assertions for every AUTO gate |
| 12 | `[MP-12] Windows H+P1+P2 release acceptance` | every WIN gate; recordings/screenshots/log bundle |
| 13 | `[MP-13] Cross-client Session UI parity contract` | J01-J08 and UI-facing checkpoints in A-I |

Dependencies:

```text
MP-01
  -> MP-02
      -> MP-03
          -> MP-04
          -> MP-05
          -> MP-06
          -> MP-07
              -> MP-08
                  -> MP-09
                  -> MP-10
                      -> MP-11
                          -> MP-12
```

Feature issues may proceed in parallel after MP-03 only when they reuse the same envelope, queue, Host authority, ownership, and recovery primitives.

## 6. Required evidence per GitHub issue

An issue is not complete with source changes alone. Its closing comment must contain:

- base SHA and final SHA;
- scenario IDs completed;
- exact automated commands and pass/fail counts;
- protocol/state/presentation assertions added;
- Windows instance topology used;
- screenshots or recording showing H, P1, and P2 where a visual outcome is involved;
- reconnect/retry evidence where applicable;
- privacy inspection for role-scoped payloads;
- remaining limitations, if any.

No issue may label a scenario `PASS` based only on a structural source test. Visual motion requires human Windows evidence. Windows evidence without deterministic state tests also does not close an authoritative scenario.

## 7. Current-state classification at catalog creation

The current source has substantial Host-authoritative request routing, ordered `event-batch` publication, Client state application, idempotency, reconnect catch-up, projected Character action tests, Party Stash recovery, Long Rest transaction work, and local body-level physics dice.

The remaining blocking gap for a complete multiplayer claim is real Windows H+P1+P2 evidence across the full catalog, including visual motion/VFX and reconnect timing. Shared staged Resolution presentation and the J01-J08 UI-facing state contracts now have automated coverage, but automated projection equality does not replace rendered multi-window acceptance. Therefore:

- authoritative result/state convergence: **implemented in significant slices, exact-head automated coverage exists**;
- H/P1/P2 cross-client state/action/inventory/presentation projection parity: **automated slices implemented; full Windows evidence pending**;
- comprehensive real Windows H+P1+P2 acceptance: **pending**;
- V1 multiplayer overall: **not complete**.

## 8. Final V1 execution lock

Owner-approved state:

- [x] Owner designated the full catalog as the final V1 objective.
- [x] GitHub Epic `#110` and implementation issues `#111` through `#122` were created.
- [x] Documentation PR `#123` was created against `work/v1-composite`.
- [ ] Merge documentation PR `#123`.
- [ ] Complete MP-01 and freeze presentation/privacy/reconnect semantics.
- [ ] Complete MP-02 through MP-10 in dependency order.
- [ ] Complete MP-11 automated H+P1+P2 acceptance.
- [ ] Complete MP-12 Windows H+P1+P2 acceptance.
- [ ] Complete the release gates in `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` on one exact SHA.

Any newly discovered multiplayer behavior must first receive a scenario ID and acceptance rule here or in the epic before code is changed.

