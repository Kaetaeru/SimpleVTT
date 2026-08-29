# Common Play Resolver / D&D Execution Language Checklist v2

Status: **CANONICAL PRODUCT PLAN FOR THIS RERUN**  
Working branch: `agent/resolver-foundation-convergence`  
Integration target: `work/v1-composite`  
Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`

This document supersedes `docs/rules/resolver-execution-checklist.md` as the active product-plan router. The older checklist remains useful historical/evidence detail for completed Gates A-E and prior migrations, but it must not override the architecture charter or this v2 plan.

The intent is deliberately explicit so a later agent cannot silently reinterpret the project as merely deleting legacy adapters, implementing only currently-shipping named features, or abandoning anticipated D&D capability coverage.

---

## 1. Product promise

SimpleVTT is building a **declarative D&D rule-execution language and generic Resolver**.

A previously unknown external RuleModule containing a supported Spell, Feat, Class/Subclass Feature, Item, Condition, Monster Ability, or other rules content must execute without adding source-code branches for its ID/name/content identity.

Canonical runtime shape:

```text
RuleModule / content JSON
        -> structural + semantic + capability validation
        -> normalization / authoring sugar expansion
        -> Common Play IR
        -> trusted generic lowering + RulesProfile semantics
        -> PendingResolution
        -> typed StateChange[]
        -> atomic authoritative commit
        -> ResolutionEvent
        -> session / persistence projection
        -> UI presentation
```

Correctly-owned non-runtime transactions remain distinct:

- progression: `ProgressionDraft -> Character revision commit`;
- module installation: reviewed activation -> installed-content persistence;
- Character durable state vs session authority: explicit write-back boundary.

Do not force these into fake combat Resolutions. The invariant is one declarative semantics model and no named-content side engine.

### Final invariant

Changing only external content IDs/names must not change mechanical results except provenance/presentation labels.

Forbidden:

```ts
if (spell.id === "known-spell") { ... }
if (feature.id === "action-surge") { ... }
const compiler = namedCompilers[contentId]
```

Allowed:

```ts
switch (operation.kind) {
  case "damage.apply": ...
  case "resource.change": ...
  case "artifact.spawn": ...
}
```

---

## 2. Non-negotiable anti-drift rules

- [ ] Read `common-play-resolver-architecture-charter.md` before architecture changes or gate selection.
- [ ] No new named execution adapter/branch for a spell, feat, class, subclass, item, condition, monster ability, or other named content.
- [ ] Existing named adapters are migration inventory and implementation-archeology references only; RulesProfile/SRD 5.2.1 defines correctness.
- [ ] Common Play capability support is never inferred merely because a schema field exists.
- [ ] New primitives require deterministic evidence that existing generic composition is insufficient or unsafe.
- [ ] New primitives must be reusable across unrelated content IDs.
- [ ] Imported content never gains arbitrary JS/eval/plugin execution.
- [ ] Unsupported mechanics are explicit, never silently approximated as supported.
- [ ] Schema/evaluator parity is mandatory for persisted executable kinds.
- [ ] UI/presentation never owns the only copy of rule-relevant state.
- [ ] Retry/replay must not double-spend or double-apply.
- [ ] One mechanically atomic resolution commits all related costs/results/frequency markers together or rolls them all back.
- [ ] Do not route V1 product work to `main`; integration target remains `work/v1-composite` unless owner direction explicitly changes.

---

## 3. Two-dimensional progress model

Future agents must track both axes. Neither replaces the other.

### Axis A — pipeline maturity for each capability family

Use these statuses:

1. `SPEC` — representable in persisted Common Play/Profile contracts;
2. `KERNEL` — generic trusted runtime semantics are implemented and tested;
3. `PORTABLE` — unknown external RuleModule data survives import, validation, persistence, rehydration, and session transfer without semantic loss;
4. `PRODUCTION` — real application/session execution reaches the generic path;
5. `MIGRATED` — absorbed named execution is deleted after parity;
6. `ACCEPTED` — unknown-ID/rename, authority, retry/reconnect, lifetime/persistence/Undo as applicable pass end-to-end.

A foundation Gate marked DONE may still need PORTABLE/PRODUCTION/MIGRATED work.

### Axis B — D&D expressive coverage

Gates A-M are a mechanism coverage map, not merely an implementation sequence.

- A — reaction / interaction / semantic recalculation;
- B — multi-target save / shared and per-target results;
- C — persistent effect / automatic event trigger;
- D — Zone artifact / membership / frequency;
- E — spatial facts / manual-provider semantic parity;
- F — maintained effects / concentration / suppression;
- G — selector + allocation;
- H — object + link artifacts;
- I — actor artifact / summon;
- J — form overlay / transformation;
- K — stored invocation / contingency-like behavior;
- L — mutable item lifecycle operations;
- M — source-bound state ownership.

A-M tell us whether the language can express difficult D&D rule structures. Legacy inventory tells us which old implementation still bypasses that language.

---

# PHASE 1 — RETAINED FOUNDATION

## F0 — Common Play Contract v0.2 — DONE

Retain existing evidence. Do not repeat without touched-surface justification.

## Gate A — Reaction / semantic recalculation — KERNEL DONE

Retain validated foundation evidence.

## Gate B — Multi-target save + shared damage — KERNEL DONE

Retain validated foundation evidence.

## Gate C — Persistent effect + automatic trigger — KERNEL DONE

Retain validated foundation evidence.

## Gate D — Zone / membership / frequency — KERNEL DONE

Canonical merge evidence remains PR #137 / `406a9574d249bb770ec7725efa1384808ddc9bc3`.

## Gate E — Spatial fact / manual authority — KERNEL DONE

Canonical merge evidence remains PR #141 / `00d3c9233bb678ec93bb828cb3941c3048c42054`, validated product candidate `12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba`.

Foundation A-E is frozen unless new deterministic evidence materially invalidates it.

---

# PHASE 2 — PORTABLE EXECUTION CONVERGENCE

Status: **ACTIVE**.

Purpose: make the Common Play language actually cross the full product pipeline, then use that path to absorb named execution. Legacy deletion is a consequence, not the governing objective.

## P0 — Legacy inventory/freeze — DONE

Authority remains `docs/rules/legacy-execution-inventory.md` plus `.agents/LEGACY_EXECUTION_BASELINE.json` and the Legacy Execution Boundary regression.

The inventory is a debt ledger and regression-reference map, not the product roadmap or a correctness oracle.

## P0.5 — V1 mechanism coverage contract — ACTIVE

`docs/rules/v1-mechanism-coverage-ledger.json` is the machine-readable Gate N authority for the complete D&D V1 coverage corpus. `scripts/check-v1-mechanism-coverage.mjs` requires every mandatory family A-AJ exactly once and rejects Gate N unless every row is `IMPLEMENTED` or `PROVEN_UNNEEDED`, has implementation/production/identity evidence, includes connected/persistence evidence where relevant, and `gateNBlockingNamedFallbacks` is empty. `remainingNamedSeams` remains the general migration-debt inventory; a seam blocks Gate N only when unknown supported content actually selects or falls through to it.

`INCOMPLETE` is allowed only while this convergence run is active. It is not a final disposition and it prevents Gate N.

## P1 — Universal migration harness

Every migrated mechanism must satisfy the applicable pipeline:

### Contract / validation

- [ ] equivalent unknown/portable RuleModule fixture exists;
- [ ] structural validation passes;
- [ ] semantic/capability validation passes;
- [ ] unsupported shapes fail explicitly;
- [ ] normalized Common Play meaning does not depend on content ID/name.

### Portability

- [ ] preview/import preserves mechanics;
- [ ] activation preserves mechanics;
- [ ] installed persistence preserves mechanics;
- [ ] restart/rehydration preserves mechanics;
- [ ] required session content / peer transfer preserves mechanics where applicable.

### Execution

- [ ] trusted generic lowering exists;
- [ ] real production/session dispatch reaches it;
- [ ] correct authoritative transaction domain owns mutation;
- [ ] runtime resolutions produce typed StateChanges and atomic commit;
- [ ] provenance remains traceable.

### Identity / authority / recovery

- [ ] arbitrary external ID executes;
- [ ] ID/name-only rename preserves semantics;
- [ ] owner/host authority parity is preserved where applicable;
- [ ] retry/replay idempotency is covered where applicable;
- [ ] reconnect/stale-response behavior is covered where applicable;
- [ ] lifetime/persistence/write-back is explicit where applicable;
- [ ] Undo/reversal behavior is covered where applicable.

### Migration

- [ ] deterministic expectations are derived from RulesProfile/SRD 5.2.1 rather than legacy output;
- [ ] affected legacy tests are classified `KEEP`, `REWRITE`, or `DELETE`;
- [ ] production generic path becomes authoritative;
- [ ] only then remove the absorbed named adapter/branch;
- [ ] no hidden fallback routes supported mechanics back to the named engine;
- [ ] shrink legacy baseline/inventory only after removal.

## P2 — Capability maturity board

Track each family independently through `SPEC -> KERNEL -> PORTABLE -> PRODUCTION -> MIGRATED -> ACCEPTED`.

Initial families:

- [x] resource / action economy — `MIGRATED`; PR #171 absorbed the built-in Action Surge named production seam after normative resource/economy proof on the generic path. `ACCEPTED` is not claimed by this migration alone;
- [x] tests / rolls / outcomes — `PRODUCTION`; generic authored actor d20 tests cross validation, normalization, installed persistence/rehydration, existing Resolver lowering, production authority, connected presentation, and ID/name rename invariance. Named post-roll features remain legacy, so `MIGRATED`/`ACCEPTED` are not claimed;
- [x] damage / healing / HP — `PRODUCTION`; authored literal/dice damage and literal healing cross validation, installed persistence/rehydration, existing Resolver lowering, single pre-resolved runtime target authority, HP writeback/Undo, connected convergence, and rename invariance. Deliberate HP/targeting boundaries remain below;
- [x] targeting / selectors / allocation — `PRODUCTION`; canonical `entryPoint.targeting` supports the bounded `from:targets`, exact `min/max:1/1` selection-validator subset through validation, persistence/rehydration, existing Resolver targeting, production authority, Undo, connected convergence, and rename invariance. Rich selectors and allocation remain unsupported;
- [x] interactions / reactions / interceptors — bounded `PRODUCTION`; manual actor boolean consent plus one Reaction economy payment executes accepted downstream Common Play operations through the existing production interrupt/authority path. Rich interactions, interceptors, and remote responder recovery remain unsupported;
- [ ] persistent effects / triggers / frequency;
- [ ] spatial facts / zones / movement;
- [ ] item activation / mutable item state;
- [ ] progression / grants / choices;
- [ ] F-M families when their coverage disposition requires implementation.

Do not migrate by class/spell/feat list order. Migrate the smallest coherent mechanism family slice.

---

## P3 — Resource / Economy migration convergence — MIGRATED

Normative probe: Fighter Action Surge supplies a deterministic SRD resource/economy scenario. Its legacy implementation does not define expected output, and `Action Surge` is not a primitive or dispatch key.

Retained generic harness evidence before PR #159:

- Common Play resource payments/economy lowering exists;
- atomicity exists;
- restricted extra Action policy is RulesProfile-owned;
- arbitrary-ID rename invariance is covered.

### PR #159 portable bridge — INTEGRATED

PR: `#159`  
Branch: `agent/m1-rulemodule-portable-activation`  
Validated candidate: `1bc7a420b90378804a5b5994fa1ad1f59b963b1d`  
Merge commit: `dfe9d4c9fa1483276f9edf40364d042f1b50f852`

Required outcome:

- [x] registered data-only Common Play mechanics survive RuleModule preview/activation;
- [x] installed-content persistence/rehydration preserves them;
- [x] required session content / peer install preserves them;
- [x] one shared validator/parser boundary is used;
- [x] unsupported/custom mechanics remain explicit failures;
- [x] no named Fighter branch, second evaluator, new transport, or hidden fallback is introduced.

Historical red/fix evidence:

- old candidate `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` passed the focused M1 behavior 4/4 before failing TypeScript because parsed `entryPoints[].invocation` widened from its literal union to `string`;
- Persistence exposed an unrelated stale hard-coded builtin catalog total `501 !== 496`;
- child contextual typing fixed only the invocation literal typing;
- parent persistence baseline was corrected independently to assert the intended builtin-only invariant instead of a stale count.

Exact-head acceptance for `1bc7a420b90378804a5b5994fa1ad1f59b963b1d`:

- [x] M1 Common Play Resource Economy `33149435346` — focused harness + TypeScript typecheck SUCCESS;
- [x] Contract validation `33149435378` — SUCCESS;
- [x] Rules Domain `33149435342` — SUCCESS;
- [x] UI `33149435365` — SUCCESS including typecheck/build;
- [x] Persistence `33149435419` — SUCCESS including persistence contracts, production build, and Tauri storage;
- [x] Phase 11 Playable `33149435390` — SUCCESS including Windows playable artifact;
- [x] Phase 12 Connected Session `33149435367` — SUCCESS including connected protocol, Tauri transport/persistence, and Windows connected-session artifact.

### PR #159 completion gate

- [x] latest child SHA resolved after the typing fix;
- [x] exact-head evidence used instead of obsolete `60c5...` conclusions;
- [x] focused M1 harness passes;
- [x] typecheck/build passes on affected workflows;
- [x] persistence baseline no longer blocks the reconciled candidate;
- [x] product diff remained bounded to seven files and contained no named-content leakage;
- [x] parent/child ancestry reconciled only as needed for product verification;
- [x] owner merge approval obtained through the Rerun continuation command;
- [x] PR #159 merged into `agent/resolver-foundation-convergence`, never `main`.

### PR #168 production bridge — INTEGRATED

PR: `#168` — `rules: dispatch installed Common Play through production authority`  
Branch: `agent/m1-installed-common-play-production`  
Validated candidate: `da4ffecd2de1b7f95d324e7170312cdd8d512797`  
Merge commit: `c372c09353de58dfcc12ad3adbe6fd118fe28106`

Required outcome:

- [x] arbitrary installed data-only Common Play mechanics enter the real production/session action authority;
- [x] dispatch uses the installed-content repository lookup, `commonPlayOperationRuntime`, the existing generic Resolver, and the shared authoritative commit path;
- [x] Character resource writeback plus turn/session/history projection and Undo are preserved;
- [x] D&D economy grants remain RulesProfile-owned;
- [x] arbitrary external package/content/mechanic/entry-point identities prove production dispatch is not selected by Action Surge identity/name;
- [x] no second evaluator, store, session transport, executable-content fallback, or named-content algorithm branch is introduced.

Exact-head acceptance for `da4ffecd2de1b7f95d324e7170312cdd8d512797` reused at merge:

- [x] Contract validation — SUCCESS;
- [x] M1 Common Play Resource Economy — SUCCESS;
- [x] Rules Domain — SUCCESS;
- [x] UI — SUCCESS;
- [x] Phase 11 Playable — SUCCESS;
- [x] Phase 12 Connected Session — SUCCESS.

PR #168 established Resource/Economy `PRODUCTION`; PR #171 subsequently absorbed the named Fighter Action Surge production seam.

### PR #171 built-in migration — INTEGRATED

PR: `#171` — `rules: migrate built-in Action Surge to generic Common Play`  
Branch: `agent/m1-action-surge-generic-production`  
Validated candidate: `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`  
Merge commit: `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f`

Migration evidence:

- [x] built-in Fighter Action Surge reaches the same generic Common Play production path;
- [x] the SRD-derived resource and turn-gate payments commit atomically;
- [x] restricted extra Action semantics remain RulesProfile-owned with `allowsMagicAction: false`;
- [x] authoritative Character/session writeback and Undo remain correct;
- [x] connected host/client convergence preserves the grant and resources;
- [x] action/content/definition/display-name-only renames preserve mechanical semantics;
- [x] arbitrary installed Common Play production coverage from PR #168 remains in the focused harness;
- [x] the named `fighterActionSurgeRuntimeAdapter.ts` production path is deleted;
- [x] `.agents/LEGACY_EXECUTION_BASELINE.json` no longer admits the removed adapter;
- [x] no replacement named fallback, evaluator, store, transport, or content-ID/name algorithm branch is introduced.

Exact-head acceptance for `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`:

- [x] focused Common Play / Action Surge normative harness — 8/8 SUCCESS on the candidate lineage;
- [x] Contract validation `33174441211` — SUCCESS;
- [x] M1 Common Play Resource Economy `33174441198` — SUCCESS;
- [x] Persistence `33174441162` — SUCCESS;
- [x] Rules Domain `33174441191` — SUCCESS;
- [x] UI `33174441234` — SUCCESS;
- [x] Phase 12 Connected Session `33174441183` — SUCCESS including Windows connected-playable;
- [x] Phase 11 Playable `33174441152` — SUCCESS including Windows playable.

Resource/Economy therefore advances from `PRODUCTION` to `MIGRATED`. This does not by itself claim the stronger `ACCEPTED` maturity status; any remaining acceptance obligations must be proven explicitly under the universal criteria.

The next Phase 2 implementation slice must be selected by mechanism family from the P2 maturity board and current legacy evidence. Do not resume a named class/spell/feat queue or speculatively activate Gates F-M merely because Resource/Economy is complete.

---

## P4 — Tests / Rolls / Outcomes production bridge — PRODUCTION

The first bounded slice reuses the existing generic Resolver `d20` operation. Common Play does not own a second dice algorithm or evaluator.

Evidence:

- [x] authored `entryPoint.test` supports actor `ability-check`, `saving-throw`, and `attack-roll` families with a literal target;
- [x] unsupported roller, per-target, property-backed modifier, and malformed target shapes fail explicitly at the shared import/persistence parser;
- [x] normalized mechanics survive package preview/activation, installed persistence/rehydration, and required-session peer transfer;
- [x] Common Play lowers the authored test to the existing `ResolutionOperation` `kind:"d20"` and generic `resolveD20Test` semantics;
- [x] arbitrary installed content reaches the existing production authoritative commit path;
- [x] Host-authoritative faces, total, and outcome converge through the existing connected Resolution presentation/event path;
- [x] content/action ID, definition ID, entry-point ID, and display-name-only renames preserve mechanics;
- [x] Resource/Economy arbitrary installed coverage and built-in Action Surge coverage remain in the focused regression harness;
- [x] no new evaluator, store, transport, fallback, or content-ID/name algorithm branch exists.

Deliberate boundary:

- property-backed stat/provider resolution, target/every-target rolls, and named post-roll features remain explicit later slices;
- Cutting Words and other unstrangled roll/outcome seams remain migration debt;
- therefore this family is `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

---

## P5 — Damage / Healing / HP production bridge — PRODUCTION

The first bounded slice reuses the existing generic Resolver `damage-roll`, `damage`, and `healing` operations. Common Play does not own a second HP or dice evaluator.

Evidence:

- [x] authored `damage.apply` supports a non-negative literal integer or bounded `XdY±Z` formula and lowers dice damage through existing `damage-roll -> damage` semantics;
- [x] authored `healing.apply` supports a non-negative literal integer and lowers directly to existing `healing` semantics;
- [x] actor/self or one already-resolved target is accepted; the production adapter validates that the target exists in both the current scene and authoritative runtime combatants, and reuses an existing action projection's eligibility when one is present;
- [x] runtime `creatureKind` comes from the typed scene entity classification, never content ID/name inference;
- [x] unsupported target shapes, healing dice, temporary HP, damage multiplier/condition fields, malformed dice, and missing authoritative dice/target/classification fail explicitly;
- [x] normalized mechanics survive package preview/activation, installed persistence/rehydration, and required-session peer transfer;
- [x] arbitrary installed data reaches the existing production authoritative commit path, mutates HP, projects typed events, persists Character-owned HP, and supports Undo;
- [x] Host-authored damage-roll/damage/healing events converge HP on the Client through the existing connected event path;
- [x] content/action ID, definition ID, entry-point ID, and display-name-only renames preserve mechanics;
- [x] Resource/Economy, built-in Action Surge, and Common Play d20 coverage remain in the focused regression harness;
- [x] no new evaluator, Resolver, state store, transport, fallback, target selector, or content-ID/name algorithm branch exists.

Deliberate boundary:

- temporary HP, compound damage, authored defenses/resistance/immunity/vulnerability, concentration checks, critical authoring, property-backed amounts, healing dice, multi-target/every-target, selectors/allocation, and spell execution remain later slices;
- Monk Wholeness of Body, Cleric damage/healing, Paladin healing/allocation, Rage riders, spell damage/healing, and other named HP seams remain unchanged;
- therefore this family is `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

---

## P6 — Targeting / Selectors / Allocation production bridge — PRODUCTION

The first bounded slice treats canonical `entryPoint.targeting` as a validator for one caller-selected target. It lowers directly to the existing generic Resolver `targeting` operation and never discovers targets.

Evidence:

- [x] only `{ from:"targets", min:1, max:1 }` is accepted; other sources, predicates, ordering, areas, and other counts fail explicitly;
- [x] normalized targeting survives package preview/activation, installed persistence/rehydration, and required-session peer transfer;
- [x] Common Play lowers targeting before payments and downstream operations to the existing `kind:"targeting"` / `resolveTargeting()` path;
- [x] the neutral bounded rule uses `directTarget:false`, so it requires no fabricated distance, visibility, or cover facts;
- [x] production facts contain only typed scene-derived creature identity and self/ally/enemy relation; selected creatures must exist in authoritative runtime combatants;
- [x] zero, multiple, nonexistent, and temporarily unavailable targets reject without downstream HP mutation or partial events;
- [x] actor/self and one other runtime combatant execute through authoritative commit, HP projection, and Undo;
- [x] Host validates and emits targeting plus downstream events; Client converges without selector reevaluation;
- [x] module/content/definition/entry-point/action/display renames preserve semantics;
- [x] Resource/Economy, Action Surge, d20, and HP coverage remain in the focused regression harness;
- [x] no selector evaluator, targeting engine, allocation engine, geometry engine, store, transport, fallback, or ID/name algorithm branch exists.

Deliberate boundary:

- selector predicates, filters, ordering, areas, automatic discovery/suggestion, multi-target, point/object targets, and target-selection UI remain unsupported;
- allocation, pool/projectile distribution, and Gate G activation remain untouched;
- harmful targeting intent and Sanctuary-like restrictions are not inferred from downstream damage;
- range, sight, cover, distance, LOS, and other spatial authoring/facts remain later provider-backed slices;
- named target-dependent feature/spell adapters remain unchanged;
- therefore this family is `PRODUCTION` only for the bounded single pre-resolved target subset, not `MIGRATED` or `ACCEPTED`.

---

## P7 — Interactions / Reactions / Interceptors production bridge — bounded PRODUCTION

The first bounded slice connects canonical authored actor consent to the existing production `ResolutionView.interrupt` lifecycle. The canonical Reaction economy payment lowers to the existing generic `use-economy` Reaction slot inside the same `PendingResolution` as resource payments and downstream operations.

Evidence:

- [x] only manual `consent` + actor responder + blocking boolean input + `revalidate:"always"` is accepted; other interaction shapes fail explicitly;
- [x] only one commit-time, refundable, amount-one `reaction` economy payment is accepted, and interaction/payment pairing is validated;
- [x] interaction-bearing entry points require matching accepted authorization at the shared compiler boundary, preventing direct compiler bypass;
- [x] invocation projects the existing interrupt presentation without consuming Reaction, resources, or applying downstream state;
- [x] decline clears the interrupt and ends presentation without mechanical mutation or replay;
- [x] accept looks up installed content again, snapshots current authority, revalidates action/actor/targets/payments, and commits Reaction plus downstream operations atomically;
- [x] unavailable Reaction, insufficient resource, and invalid target reject without partial mutation;
- [x] accepted Reaction plus healing support authoritative writeback, Undo, and duplicate-response safety;
- [x] normalized interaction/payment data survives preview, activation, installed persistence/rehydration, and required-session peer transfer;
- [x] Host acceptance converges Reaction and downstream state to Client through the existing event path without Client mechanics recalculation;
- [x] module/content/definition/entry-point/interaction/action/display renames preserve semantics;
- [x] no prompt framework, pending store, interaction/reaction engine, transport, fallback, or ID/name algorithm branch exists.

Deliberate boundary:

- broader `roll.modify`, roll reduction, triggered dispatch, target/owner/DM responders, multiple options, and remaining named post-roll migrations remain unsupported;
- remote responder routing, reconnect continuation, stale restart, and persistent pending interaction are not claimed; the connected proof uses Host as responder;
- Cutting Words remains a legacy migration reference until re-derived from RulesProfile/SRD 5.2.1;
- therefore this family is bounded `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

---

## C3 — Generic roll / selector / allocation / spatial / movement primitives — bounded

This checkpoint supersedes the older P6/P7 notes that called `roll.modify`, allocation, and provider-backed spatial facts wholly unsupported.

Evidence:

- [x] one existing d20 path applies structural advantage/disadvantage, flat/additional-die modifiers, target/DC changes, reroll, replacement, minimum roll, and outcome recalculation from authoritative inputs;
- [x] missing modifier dice authority rejects before commit and content/definition renames preserve mechanics;
- [x] fixed-pool allocation validates exact integer sums, target bounds, identity, revision, and retry before downstream execution;
- [x] Magic Missile production selection preserves the player's authored projectile sequence instead of inventing an equal distribution;
- [x] selectors filter and order structural candidates; area selection requires authoritative membership and never invents geometry;
- [x] standard spatial/sense facts distinguish sight, hearing, detection, cover, light, and obscurement without treating absent facts as false geometry;
- [x] movement uses existing Resolver operations for profile-scaled movement, push, pull, and teleport with opaque provider/manual destinations.

Deliberate boundary:

- these are reusable primitives and bounded production wiring, not full A-AJ acceptance;
- rich post-roll responder routing, triggered dispatch, persisted decisions, native geometry calculation, and remaining named adapters are still incomplete;
- the V1 mechanism ledger remains `INCOMPLETE` until production, identity, connected, persistence, and strangler evidence for each row is complete.

---

## C4 — Maintained effects / frequency / ordering / stored invocation primitives — bounded

Evidence:

- [x] active effects can be suppressed and unsuppressed through Resolver state changes; elapsed duration can explicitly pause and resume without leaking condition/modifier mechanics;
- [x] one generic frequency token policy covers unlimited, once, once per turn, once per round, and once per resolution; zone rules use it instead of a zone-only marker algorithm;
- [x] simultaneous effects produce a typed, revision-bound ordering decision and accept only an exact authoritative permutation with deterministic replay;
- [x] stored invocation is a session RuntimeArtifact, not a WeakMap: capture cost plus storage is atomic, semantic triggers are structural, Reaction plus payload plus consumption is exactly one atomic commit, and ignore/cancel/stale/replay paths preserve authority;
- [x] stored invocation artifacts have real turn-boundary expiry and optional maintained-Concentration identity.

Deliberate boundary:

- legacy Ready UI/connected routing still uses its old adapter until the C8 strangler checkpoint moves it onto this artifact primitive;
- full remote ordering/interaction presentation persistence and every N-S production composition remain incomplete and are not marked accepted in the ledger.

---

## C5 — Object / actor / form / link / item / attunement primitives — bounded

Evidence:

- [x] RuntimeArtifact has distinct typed object, link, actor, and form families; none is disguised as a Creature or Zone;
- [x] object AC/HP/damage threshold/defenses/repair/destruction/placement run through Resolver operations with reversible artifact state changes;
- [x] links retain explicit endpoints and barrier/wall/portal/tether/rope semantics; dangling endpoints reject before commit;
- [x] actor artifacts retain stat projection, actions, resources, owner, controller, placement, initiative policy, lifetime, and controller transfer data;
- [x] form artifacts retain property overlays, retained/replaced properties, resource/action/HP/spellcasting policies, controller, replacement lifetime, and reversible state;
- [x] a separate Character-durable inventory revision transaction covers grant, quantity, consume/destroy, charges, equip/wield, container ownership, two-owner transfer, and atomic rollback;
- [x] attunement requires Short Rest completion, structural prerequisites, capacity, exclusive ownership, benefit activation, cursed removal rules, and rule-driven loss.

Deliberate boundary:

- production Character inventory persistence and connected journals remain the authority; C8 must adapt them to these semantics rather than replace their durability protocol;
- summon combatant materialization, form projection into the live action catalog, and legacy item/attunement UI migration are still incomplete.

---

## C6 — Spellcasting / progression / project / hazard / special-timing primitives — bounded

Evidence:

- [x] typed spell-component facts enforce Verbal/Somatic/Material availability, silence, free hands, focus/pouch substitution, costly materials, and consumed-material output; long/ritual casting has an interruptible maintained activity primitive;
- [x] unknown RuleModule progression contributions survive validation, installation, persistence shape, and a revision-bound track/threshold/grant transaction without class-ID dispatch;
- [x] Recharge uses one authoritative die face inside the existing Resolver, changes the existing resource pool atomically, records reversible state changes, and rejects stale replay;
- [x] owner-authorized off-turn and initiative-count timing compiles cost plus payload into the existing Resolver instead of a monster engine;
- [x] revision-bound project and exposure owners cover accumulated work/payment, elapsed thresholds, periodic triggers, and recovery;
- [x] mount size/controller/action facts and profile-driven environment movement, attack, damage-defense, and falling semantics compose without actor/weapon identity branches.

Deliberate boundary:

- legacy spell definitions without typed component declarations still use the deprecated `componentsSatisfied` compatibility input until C8 migration; material consumption output is not yet joined to the durable inventory transaction;
- existing Phase08 progression/UI adapters and spell runtime routers remain named seams; imported contributions are preserved and executable by the generic transaction but are not yet projected into the current level-up UI;
- special timing, project, exposure, mount, and environment primitives still require C7 composition proofs and C8 connected/persistence adapters before any ledger row can be marked complete.

---

## C7 — Representative D&D composition proofs — bounded

Evidence:

- [x] `common-play-representative-scenarios.json` records every mandatory scenario from the master run and a contract test prevents missing or orphaned executable evidence;
- [x] the composition suite executes 79 deterministic tests covering post-roll modification, shared multi-target saves, allocation, maintained triggers, Zones, mapless/provider targeting, movement, senses, Concentration, ordering, Ready attack/spell, artifacts/forms/controllers, items/attunement, Recharge/special timing, project/exposure/environment, and all eight Weapon Masteries;
- [x] Sap/Vex reuse generic target-aware d20 modifier Effects, Slow reuses a generic speed-delta Effect, and the other masteries compose existing d20/economy/frequency/movement/damage/condition operations;
- [x] the representative scenarios use unknown external identities or rename proofs; scenario names are evidence labels and never select an algorithm.

Deliberate boundary:

- deterministic domain composition is not production, connected, persistence, or UI acceptance evidence;
- C8 must still move named production adapters onto these paths and reduce the legacy baseline before ledger rows can change final disposition.

---

## C8 — Legacy strangler — in progress

Verified migration slices:

- [x] the atomic saving-throw transaction no longer imports or looks up Fighter Indomitable identity; it replays the authoritative generic save preview (`d20`, `total`, outcome) and rejects drift in the existing transaction;
- [x] projected Character resource synchronization now matches generic resource identities from authoritative runtime state, including forward application and Undo;
- [x] the obsolete Indomitable modifier WeakMap was deleted and the atomic saving-throw adapter was reclassified as `GENERIC_ENGINE`;
- [x] the atomic attack transaction no longer imports or matches Rage identity; active Effects contribute flat attack damage through generic ability/source-kind predicates, with an unknown renamed Effect proving identity invariance;
- [x] hostile attack/save extension and linked special-duration expiry moved out of the Resolver's Rage branch into generic extendable-Effect metadata; a renamed unknown Effect proves extension and turn survival;
- [x] spellcasting restrictions now read active Effect metadata rather than Rage/Wild Shape tags, with an unknown external Effect proving identity invariance;
- [x] atomic no-roll item damage now derives dice, flat damage, and item execution from the authored action shape rather than `action.wand`; an unknown renamed item action proves transaction, persistence projection, and damage provenance remain identical;
- [x] healing previews now derive their fixed authoritative formula facts from any authored healing action instead of a three-action ID table; unknown-ID service and adapter proofs cover roll, HP application, economy/item payment, persistence, and Undo;
- [x] the duplicate `action.shortbow` atomic branch and reference attack/target maps were deleted; runtime attacks now require authored structural attack facts and an unknown renamed action proves the same atomic attack, event, and Undo path;
- [x] the entity-ID save-modifier table and its inner saving-throw branch were deleted; canonical saves now enter the existing Character/Combatant runtime-stat provider, including explicit missing-authority rejection;
- [x] canonical runtime attacks no longer fabricate zero distance, visibility, or cover when no spatial module is present; explicit target selection supplies typed `manual-unconstrained` authority, while an authoritative module relation still enforces range, sight, cover, and target sight;
- [x] Host-mounted and owning-Client Characters now receive weapon ability/range facts and the inactive Rage action from the same pure Character action projection; the redundant active-Character-only weapon post-processor was deleted, and the complete connected UI suite proves initial action-bar parity plus inventory/Undo/retry convergence;
- [x] deterministic runtime attack dice are derived only from authored dice structure, never from the presentation-only `average` field; the full build exposed and now proves the Rogue Uncanny Dodge raw/halved damage contract alongside the atomic attack rename proof;
- [x] the atomic self-healing adapter no longer recognizes `action.second-wind`; any non-item, non-spell authored self-healing action uses the same HP/economy/resource/event/Undo transaction, with an unknown action-ID production proof;
- [x] the named Bardic Inspiration attack follow-up adapter was replaced by a structural consumable d20-bonus Effect path; generic d20 recalculation, Effect consumption, atomic attack preview parity, connected replay, Undo, and a fully renamed external Effect now share one execution path without the former action mutation or pending WeakMap;
- [x] the runtime-presence spell router and legacy spell handler were deleted; supported freeform and initiative spells now create or reuse one authoritative TurnRuntime and use event-native Undo, while spell-ID mechanic lookup remains explicitly incomplete;
- [x] Dash execution now reads a positive structural movement-budget grant rather than `action.dash`; a renamed unknown action and Cunning Action's structural clone use the same Bonus Action/movement event path, and the duplicate Rogue Dash mutation/event branch is deleted;
- [x] standard no-roll status changes and check-threshold status changes execute from authored facts; Disengage, Dodge, Help, Hide, Ready, and Utilize IDs no longer select their production execution algorithm;
- [x] no-roll and ability-check threshold status effects commit generic economy/Effect events, connected replay, attack-ending cleanup, and Undo without a Rogue or action-ID branch;
- [x] Bardic Inspiration grant execution moved onto a structural effect-grant action: authored economy/resource/duration/public metadata commit atomically, connected replay and Undo remain green, and an unknown action ID proves identity invariance; only its class-level resource materializer remains named;
- [x] Divine Sense activation now composes the same structural effect grant with termination and a generic creature-type awareness query; its named action adapter is deleted while mapless/module distance behavior, connected replay, Undo, and unknown-identity evidence stay green;
- [x] Tactical Mind now uses a structural failed-check add-die fact, conditional resource payment, and action-authored success operation through the existing d20/Resolver transaction; the named follow-up adapter is deleted while Stabilize, open-DC, connected replay, Undo, and unknown-ID evidence remain green;
- [x] Dark One's Own Luck is re-derived from SRD 5.2.1 rather than its legacy output: a structural after-roll d10 rule covers ability checks and saving throws, accept-time payment, once-per-roll handling, Long-Rest resource state, connected owner persistence/reconnect/Undo, and unknown identities; the named app/domain Resolver paths are deleted;
- [x] Peerless Skill is re-derived from SRD 5.2.1: failed ability checks and attack rolls share the structural add-die transaction, payment occurs only on rescued success, a rescued attack continues directly from authoritative hit state without action mutation, and connected owner persistence/reconnect/Undo plus unknown identities are proven; the named app/domain Resolver paths are deleted;
- [x] Indomitable is re-derived from SRD 5.2.1 p.48: a structural failed-save reroll preserves authoritative modifier and roll-state facts, adds the authored Fighter-level bonus, requires the new result, consumes its Long-Rest resource on acceptance, and uses the same generic d20 transaction for production owner prompting, Host/Client convergence, replay, persistence, Undo, and unknown identities; the named app/domain Resolver paths are deleted;
- [x] focused d20 follow-up and Indomitable Host/Client/Undo, legacy boundary, TypeScript, and the 79-scenario Common Play composition suite pass.

Remaining boundary:

- the Cutting Words post-roll adapter remains `LEGACY_EXECUTION`;
- named legacy spell/class consumers still call the compatibility targeting provider that fabricates mapless facts; only the canonical attack/concentration transaction is migrated by this slice;
- no coverage-ledger row is promoted by this bounded migration alone.

---

# PHASE 3 — ANTICIPATED D&D CAPABILITY COVERAGE F-M

Status: **COVERAGE DISPOSITIONS RESOLVED; LEDGER/PRODUCTION ACCEPTANCE REMAINS BEFORE GATE N**.

The old rule “only a current legacy migration may activate F-M” is superseded.

F-M were deliberately anticipated because D&D contains difficult rules that a generic language must be able to represent safely.

## Required disposition for every F-M gate

Before Gate N, each gate must be exactly one of:

- `IMPLEMENTED` — deterministic scenario proved a reusable missing semantic and the capability was implemented/verified;
- `PROVEN_UNNEEDED` — deterministic representative D&D scenario composes safely from existing primitives, with tests proving that no new primitive is required;

`DORMANT`, `PLANNED`, or `TBD` is not a valid Gate-N-entry disposition.

A coverage probe may be triggered by either:

1. a real shipping/legacy migration failure; or
2. a deliberately selected representative RulesProfile/SRD 5.2.1 scenario, regardless of whether legacy code exists.

For every probe:

- [ ] capture deterministic input/state/trigger/output;
- [ ] attempt existing Common Play composition first;
- [ ] verify authority/lifetime/state ownership;
- [ ] if composition succeeds cleanly, mark `PROVEN_UNNEEDED` with evidence;
- [ ] if composition fails for a reusable reason, define the smallest generic capability and activate implementation;
- [ ] never create a named primitive from the representative spell/feat/feature.

## Gate F — Maintained effects / concentration / suppression

Representative risk: concentration-like maintained source, interruption, suppression vs removal, dependent cleanup.

Disposition: `PROVEN_UNNEEDED` — persistent effect, concentration, suppression/pause, duration, and dependent cleanup compose from existing Resolver primitives. Evidence: `commonPlayEffectRuntime.test.ts`, `commonPlayEffectSuppressionRuntime.test.ts`, `commonPlayRepresentativeGaps.test.ts`.

## Gate G — Selector + Allocation runtime

Representative risk: fixed pool/projectile/charge distribution across selected targets.

Disposition: `IMPLEMENTED` — revision-bound fixed-pool allocation with target bounds, duplicate rejection, property-backed totals, and identity invariance exists in `commonPlayAllocationRuntime.ts`; evidence: `commonPlayAllocationRuntime.test.ts`. Its connected production decision path remains a coverage-ledger gap, not a missing primitive.

## Gate H — Object and Link artifacts

Representative risk: walls/barriers/portals where Zone or Actor semantics are incorrect.

Disposition: `IMPLEMENTED` — typed object/link artifacts now cross canonical JSON lowering and the generic production Resolver route. Evidence: `commonPlayArtifactRuntime.ts`, `commonPlayArtifactActivationRuntime.test.ts`, `commonPlayArtifactFamiliesRuntime.test.ts`, `installedCommonPlayLoweredFamiliesProduction.test.ts`.

## Gate I — Actor artifact / summon runtime

Representative risk: declarative summon/spawn with ownership, control, placement, lifetime, reconnect.

Disposition: `IMPLEMENTED` — typed actor artifacts carry stat/action/resource, owner/controller, initiative, placement, lifetime, connected state, and identity-invariant production activation through the same artifact runtime evidence as Gate H.

## Gate J — Form overlay / transformation

Representative risk: Wild Shape/Polymorph-like state overlay, restoration, property/resource projection, Undo/reconnect.

Disposition: `IMPLEMENTED` — typed form artifacts carry target/controller, property overlay/retention/replacement, HP/action/spellcasting policies, lifetime, Undo, and connected state through the same artifact runtime evidence as Gate H.

## Gate K — Stored invocation / contingency-like behavior

Representative risk: capture now, trigger later, snapshot-vs-live bindings, exactly-once consumption.

Disposition: `IMPLEMENTED` — stored invocation capture/trigger/cancel owns snapshot/live binding, Reaction payment, expiry, Concentration, exactly-once consumption, stale rejection, and identity invariance. Evidence: `commonPlayStoredInvocationRuntime.ts`, `commonPlayStoredInvocationRuntime.test.ts`, `commonPlayRepresentativeGaps.test.ts`. Generic production orchestration remains a ledger gap.

## Gate L — Item lifecycle operations

Representative risk: create/copy/consume/destroy/update mutable ItemInstance state with atomic result/payment and durable ownership.

Disposition: `IMPLEMENTED` — revision-bound inventory transactions own grant/quantity/destroy/equip/wield/charges, owner transfer, containers, attunement, rollback, and identity invariance. Evidence: `commonPlayInventoryRuntime.ts`, `commonPlayInventoryRuntime.test.ts`, `commonPlayRepresentativeGaps.test.ts`. Generic Character production write-back remains a ledger gap.

## Gate M — Source-bound state ownership

Representative risk: temporary/runtime state whose correct ownership is the generating source and cannot safely be inferred from unrelated scalar state.

Disposition: `PROVEN_UNNEEDED` — `sourceId`, `sourceActorId`, explicit owner/controller, concentration group, artifact expiry, and durable owner revisions already express source-bound ownership without another state primitive. Evidence: `commonPlayArtifactActivationRuntime.test.ts`, `commonPlayStoredInvocationRuntime.test.ts`, `commonPlayInventoryRuntime.test.ts`.

---

# PHASE 4 — FINAL CONVERGENCE / GATE N

Gate N is not another missing primitive. It is the final architecture acceptance test.

## N0 — Entry requirements

- [ ] every D&D mechanism family in `v1-mechanism-coverage-ledger.json` is `IMPLEMENTED` or deterministically `PROVEN_UNNEEDED`;
- [ ] every F-M gate has `IMPLEMENTED` or `PROVEN_UNNEEDED` disposition;
- [ ] `node scripts/check-v1-mechanism-coverage.mjs --gate-n` succeeds;
- [ ] no supported mechanic depends on a hidden named engine fallback;
- [ ] unsupported capability behavior is explicit.

## N1 — Unknown multi-category external RuleModule

Create/import a module that did not exist when the app was built. It should exercise multiple content categories, for example several of:

- [ ] unknown Spell;
- [ ] unknown Feat;
- [ ] unknown Class/Subclass Feature;
- [ ] unknown Item;
- [ ] unknown Condition;
- [ ] unknown Monster Ability.

These are category/presentation identities only; execution must compose from already-supported generic capabilities.

## N2 — Full graph E2E

- [ ] RuleModule/content JSON;
- [ ] validation;
- [ ] normalization;
- [ ] Common Play IR;
- [ ] trusted generic lowering;
- [ ] Resolver / correct generic transaction domain;
- [ ] PendingResolution where runtime-interactive;
- [ ] typed StateChange[];
- [ ] authoritative session commit;
- [ ] Character owner write-back/persistence where applicable;
- [ ] reconnect/retry/Undo where applicable;
- [ ] UI projection/presentation.

## N3 — Identity invariance

- [ ] rename every external content ID/name while preserving mechanics;
- [ ] rerun the module;
- [ ] semantic outcomes remain equivalent except provenance/presentation identity.

## N4 — Cross-mechanism composition

At minimum cover supported combinations such as:

- [ ] reaction + payment + roll/outcome modification;
- [ ] multi-target selection + saves + shared/per-target result;
- [ ] persistent effect + automatic trigger + cleanup;
- [ ] Zone/membership + frequency;
- [ ] spatial/manual fact + instantaneous target selection;
- [ ] representative combinations from every F-M gate marked IMPLEMENTED.

## N5 — Failure behavior

- [ ] unsupported capability is explicit;
- [ ] missing optional provider uses manual authority only where supported;
- [ ] no provider/manual path fabricates an answer;
- [ ] unsafe executable content may remain inspectable/round-trippable but is never falsely reported executable.

## N6 — No-edit acceptance

Adding the unknown supported module requires:

- [ ] zero React feature branch;
- [ ] zero session feature branch;
- [ ] zero resolver content-ID/name branch;
- [ ] zero feature-specific runtime adapter;
- [ ] zero rebuild-time registration of its content IDs.

Gate N passes only when the system demonstrates that Common Play is a portable D&D execution language rather than a collection of named migrations.

---

## 4. Universal Definition of Done

For every executable migration/gate/probe, apply only the relevant checks but never weaken them silently.

### Scenario / semantics

- [ ] concrete deterministic scenario;
- [ ] existing primitives attempted first;
- [ ] smallest reusable missing semantic if expansion is required;
- [ ] no named-content dispatch;
- [ ] unsupported behavior explicit;
- [ ] schema/evaluator parity.

### State / authority

- [ ] correct authority owns the mutation;
- [ ] typed StateChanges for runtime state;
- [ ] atomicity;
- [ ] retry/replay idempotency where applicable;
- [ ] persistence/lifetime/cleanup explicit where applicable;
- [ ] reconnect/stale response where applicable;
- [ ] Undo/reversal where applicable.

### Portability / identity

- [ ] unknown external ID executes;
- [ ] ID/name-only rename invariance;
- [ ] import/persistence/rehydration path covered where applicable;
- [ ] no hidden compatibility fallback.

### Verification evidence

Record:

```text
head: <exact SHA>
environment: <OS/runtime/toolchain>
command: <exact command>
result: <pass/fail and counts>
artifact/run: <workflow/job/artifact when applicable>
```

- [ ] focused exact-SHA test;
- [ ] impacted regression only where justified;
- [ ] typecheck/build for touched surfaces;
- [ ] connected/persistence/Windows evidence only when relevant;
- [ ] unavailable required environment is `VERIFICATION BLOCKED`, not inferred green;
- [ ] unrelated CI red classified separately;
- [ ] final diff reviewed for named leakage and drive-by cleanup;
- [ ] owner approval before merge when required.

---

## 5. ChatGPT / Codex / future-agent decision boundary

ChatGPT/design work owns:

- architecture intent;
- capability vs named-content distinction;
- F-M probe/disposition decisions;
- RulesProfile/provider/authority/lifetime boundaries;
- acceptance scenarios and review of evidence.

Repository implementation may proceed once the contract is bounded:

- schema/validator/evaluator changes;
- generic lowering/runtime wiring;
- production/session integration;
- tests/fixtures;
- deletion of newly obsolete named execution;
- exact-SHA verification and PR preparation.

Stop and return to architecture review if:

- named-content branching appears necessary;
- a new primitive seems necessary without a reusable semantic contract;
- authority/lifetime/state ownership is ambiguous;
- current contracts materially conflict;
- a broad redesign has multiple valid product choices.

A future agent must not silently replace the charter/checklist philosophy with a preferred alternative. If it believes the architecture is wrong, it must identify the concrete contradiction/failure and surface the decision before changing direction.

---
